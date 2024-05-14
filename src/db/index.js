import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async()=>{
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
        console.log(`\n MongoDB connected !! DB HOST : ${connectionInstance.connection.host}`)
    } 
    catch (error) {
        console.log("MongoDB connection failed ",error);
        //* nodejs gives us access to process toh process ham kahi par bhi use kar sakte hai isko hame import bhi nahi karna padta
        //* process matalb hamari current application chal rahi hai voh ek na ek process par chal rahi hogi , toh "process" uska reference hai 
        process.exit(1)
    }
}

export default connectDB;