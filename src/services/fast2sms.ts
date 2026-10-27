import dotenv from "dotenv";
import axios from "axios";
import OtpModel from "../models/Otp.js";
dotenv.config();
export const sendOtp = async (phoneNumber: string,): Promise<any> => {
    try {
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        await OtpModel.findOneAndDelete({ phoneNumber });
        await OtpModel.create({
            phoneNumber,
            otp,
            expiry: new Date(Date.now() + 5 * 60 * 1000)
        });
        const res = await axios.post("https://www.fast2sms.com/dev/bulkV2",
            {
                route: "dlt",
                sender_id: "DILENT",
                entity_id: process.env.ENTITY_ID,
                message: process.env.TEMPLATE_ID,
                variables_values: `${otp}|5`,
                numbers: phoneNumber
            },
            {
                headers: {
                    authorization: process.env.FAST2SMS_API_KEY,
                    "Content-Type": "application/json"
                }
            }
        );

        return res.data;
    } catch (err) {
        console.log(err);
    }
}