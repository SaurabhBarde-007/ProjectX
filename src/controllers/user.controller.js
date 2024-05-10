import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import zod from "zod";
import { User } from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js"

const userSchema = zod.object({
    fullname:zod.string(),
    email:zod.string().email(),
    username:zod.string(),
    password:zod.string()
})

const registerUser = asyncHandler( async (req,res) => {
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
    
    const userData = userSchema.safeParse(req.body);
    console.log(user);

    if(!userData.success){
        throw new ApiError(400,"fullname is required")
    }

    const existedUser = await User.findOne({
        $or:[{ username : userData.data.username },{ email : userData.data.email }]
    })

    if(existedUser){
        throw new ApiError(409,"User with email or username exsits")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path
    // middleware request ke andar aur fields add karta hai 
    // toh jaise req.body by default express ne provide kiya hai 
    // similarly multer hame req.files ka access deta hai 
    // abb "avatar" ke paas kafi options hote hai 
    // actually jab field ata hai tab usme hame kafi properties milti hai (like is file jpg, png ,etc)
    // but haam yaha pe chahiye first property , kyu ki first property ke andar yek object milta hai 
    // .path se hame jo bhi avatar ka path jo ki multer ne upload kara hai voh hame mil jayega 

    const coverImageLocalPath = req.files?.coverImage[0]?.path

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400, "Avatar file is required");
    }

    const user = User.create({
        fullname:userData.data.username,
        avatar: avatar.url,
        coverImage:coverImage?.url || "",
        email:userData.data.email,
        password:userData.data.password,
        username:userData.data.username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
      "-password -refreshToken"
    );

    if(!createdUser){
        throw new ApiError(500,"something error while registering a user")
    }

    return res.status(201).json(
        new ApiResponse(200,createdUser,"user registered successfully")
    )
})

export {registerUser}