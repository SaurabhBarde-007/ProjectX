import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import zod from "zod";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";

const userSchema = zod.object({
  fullname: zod.string(),
  email: zod.string().email(),
  username: zod.string(),
  password: zod.string(),
});

const loginSchema = zod.object({
  email: zod.string().email(),
  username: zod.string(),
  password: zod.string(),
});

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    //kyu ki user mongodb se bankar aya hai isliye hamare pass save method yaha par bhi availabel hai
    //jab ham save kar rahe honge na tab yaha par mongoose ke model kickin ho jate hai for example yeh password vala field bhi kickin hojayega
    //ki yeh jab bhi save karoge tab password lagega aisi situation mai yaha pe yek aur parameter pass karte i.e validateBeforeSave
    //matlab validation kuch maat lagao seedha jake save kardo mujhe pata hai mai kya kar rha hu

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating refresh and access token "
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  //* get user details from frontend
  //* validation - like checking either required fields are empty , email is in correct format or not
  //* check if user already exsits: either username or email
  //* check for images , check for avtar
  //* upload them on cloudinary , avatar (check for both multer and cloudinary that the image is being properly provided)
  //* create user object - create entry in db
  //* remove password and refresh token field from response
  //* check for user creation
  //* return response

  // const {fullname,email,username,password} = req.body;
  // console.log("email : ",email);

  // if(
  //     [fullname,email,username,password].some((field)=> field?.trim() === "")
  // ){
  //     throw new ApiError(400,"fullname is required")
  // }

  console.log(req.body);
  const userData = userSchema.safeParse(req.body);
  console.log(userData);

  if (!userData.success) {
    throw new ApiError(400, "fullname is required");
  }

  const existedUser = await User.findOne({
    $or: [{ username: userData.data.username }, { email: userData.data.email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username exsits");
  }

  console.log(req.files);
  const avatarLocalPath = req.files?.avatar[0]?.path;
  // middleware request ke andar aur fields add karta hai
  // toh jaise req.body by default express ne provide kiya hai
  // similarly multer hame req.files ka access deta hai
  // abb "avatar" ke paas kafi options hote hai
  // actually jab field ata hai tab usme hame kafi properties milti hai (like is file jpg, png ,etc)
  // but haam yaha pe chahiye first property , kyu ki first property ke andar yek object milta hai
  // .path se hame jo bhi avatar ka path jo ki multer ne upload kara hai voh hame mil jayega

  //   const coverImageLocalPath = req.files?.coverImage[0]?.path;
  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    Array.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  const user = await User.create({
    fullname: userData.data.username,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email: userData.data.email,
    password: userData.data.password,
    username: userData.data.username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "something error while registering a user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "user registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  //* req body =>  user data
  //* username or email for login
  //* find the user
  //* password check
  //* access and refresh token
  //* send cookie

  console.log(req.body);
  const userData = loginSchema.safeParse(req.body);
  // console.log(req);
  console.log(userData);

  // this is the case where we want the both username and email
  if (!userData.data.username && !userData.data.email) {
    throw new ApiError(400, "username or email is required");
  }

  // this is the case when we either want username or email
  // if(!(userData.data.username || userData.data.email)){
  //   throw new ApiError(400,"username or email is required")
  // }

  const user = await User.findOne({
    $or: [{ username: userData.data.username }, { email: userData.data.email }],
    //* $or is mongodb operator
    //* $or ke andar haam array pass kar sakte hai aur uss array ke andar objects pass kar sakte hai
    //* abb yeh $or operator find karega yek value ko yah toh voh username ke base pe mil jaye ya fir email ke basis par mil jaye
  });

  if (!user) {
    throw new ApiError(404, "User does not exists");
  }

  const isPasswordValid = await user.isPasswordCorrect(userData.data.password);

  if (!isPasswordValid) {
    throw new ApiError(404, "Invalid User Credentials");
  }
  //* yaha pe jo method access karna hai yeh "User" nahi karne hai
  //* "User" mongoose ka object hai toh mongoose ke through jo methods availabel hai jaise ki findOne , updateOne yeh apke mongoDB ke jo mongoose uske through availabel hai
  //* jo methods hamne banaye hai like isPasswordCorrect , generateTokens yeh sab hamare "user" mai availabel hai jo ki hamne database se vapis liya hai, uska instance liya hai

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  // user.save({validateBeforeSave:false});
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  //sending cookies
  // cookies jab bhi haam bhejte tab hame kuch options design karne hote hai

  const options = {
    httpOnly: true,
    secure: true,
  };

  // cookies by default usko koi bhi modify kar sakta hai frontend pe but httpOnly aur secure true karte hai
  //tab yeh cookies sirf server se modifiable hoti hai haam isko frontend se modify nahi kar sakte isko haam dekh sakte hai but modify nahi kar sakte

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User Logged in Successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true, //* toh return mai jo response milega usme new updated value milegi kyuki agar old value milegi toh usme refreshToken bhi aa jayega
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User Logged out successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incommingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incommingRefreshToken) {
    throw new ApiError(401, "unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incommingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incommingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "refresh token is expired or used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access Token refresh successfully"
        )
      );
  } catch (error) {
    throw new ApiError(410, error?.message || "invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "invalid old password");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "current user fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullname, email } = req.body;

  if(!fullname || !email){
    throw new ApiError(400,"All fields are required ")
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
        $set:{
          fullname,
          email
        }
    },
    {new:true}
  ).select("-password")

  return res
  .status(200)
  .json(new ApiResponse(200, user, "Account Details updated successfully"))
});

const updateUserAvatar = asyncHandler(async(req,res)=>{
   const avatarLocalPath = req.file?.path

   if(!avatarLocalPath){
    throw new ApiError(400,"Avatar file is missing")
   }

   const avatar = await uploadOnCloudinary(avatarLocalPath)

   if(!avatar.url){
      throw new ApiError(400, "Error while uploading on avatar");
   }
   
   const user = User.findByIdAndUpdate(
     req.user?._id,
     {
       $set: {
         avatar:avatar.url
       },
     },
     { new: true }
   ).select("-password")

   return res
   .status(200)
   .json(new ApiResponse(200,user,"Avatar image updated successfully"))
})

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url) {
    throw new ApiError(400, "Error while uploading on avatar");
  }

  const user = User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
  .status(200)
  .json(new ApiResponse(200, user, "Cover image updated successfully"));

});

const getUserChannelProfile = asyncHandler(async(req,res)=>{
  const {username} = req.params;

  if(!username?.trim()){
    throw new ApiError(400,"username is missing");
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },

    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },

    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },

    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },

        channelsSubscribedToCount: {
          $size: "$subscribedTo",
        },

        // this is we doing to check whether we have subscribed to that channel or not
        isSubscribed: {
          $cond: {
            // logic behind is this that we try to find our name is present or not in the documents (array) recieved in the subscribersCount
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then:true,
            else:false
          },
        },
      },
    },

  ]);

  if (!channel?.length) {
    throw new ApiError(404,"channel does not exsists")
  }

  return res
  .status(200)
  .json(
    new ApiResponse(200,channel[0] , "user channel fetched successfully")
  )
})

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
};
