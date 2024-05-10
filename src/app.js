import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser";

const app = express();

app.use(cors({
    origin : process.env.CORS_ORIGIN,
    credentials:true
}))

app.use(express.json({limit:"16kb"}))
app.use(express.urlencoded({extended:true,limit:"16kb"}))
app.use(express.static("public"))
app.use(cookieParser())

// routes import 

import userRouter from "./routes/user.routes.js"

//routes declaration
//** intially haam yaha app.js mai routes likh rahe the aur controllers bhi , but abb jab cheejo ko seprate kar diya hai router aur controller ko haam alag alag likh rahe hai 
//*  toh abb router ko vapis lane ke liye middleware ko use karna padega 

app.use("/api/v1/users", userRouter)

export {app}