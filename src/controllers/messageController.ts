import { Request, Response } from "express";
import Messages from "../models/Messages.js";
import Conversation from "../models/Converstion.js";


export const SendMessage = async (req: Request, res: Response): Promise<void> => {
    const { senderId, receiverId, message } = req.body;
console.log(req.body)
    if (!senderId || !receiverId || !message) {
        res.status(400).json({
            success: false,
            message: `${!senderId ? "Sender Id" : !receiverId ? "Receiver Id" : "Message"} is required.`,
        });
        return;
    }

    try {
        // Create a new message
        const newMessage = new Messages({
            userId: senderId,
            message,
        });

        // Save the message first
        const savedMessage = await newMessage.save();

        // First try to find an existing conversation
        let conversation = await Conversation.findOne({
            members: {
                $all: [senderId, receiverId],
                $size: 2
            }
        });

        if (conversation) {
            // If conversation exists, update it
            conversation = await Conversation.findByIdAndUpdate(
                conversation._id,
                {
                    $push: { messages: savedMessage._id }
                },
                { new: true }
            );
        } else {
            // If no conversation exists, create a new one
            conversation = await Conversation.create({
                members: [senderId, receiverId],
                messages: [savedMessage._id]
            });
        }

        res.status(200).json({
            success: true,
            message: "Message sent successfully",
            data: {
                newMessage: savedMessage,
                conversation: conversation,
            },
        });
    } catch (error) {
        console.error("Message error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to send message. Please try again."
        });
    }
};

export const getMessages = async (req: Request, res: Response): Promise<void> => {
    const { senderId, receiverId } = req.body;
    console.log(req.body)
    // console.log('sendia',senderId,'reciverid')
    if (!senderId || !receiverId) {
        res.status(400).json({
            success: false,
            message: `${!senderId ? "Sender Id" : "Receiver Id"} is required.`,
        });
        return;
    }

    try {
        // Find the conversation
        const conversation = await Conversation.findOne({
            members: {
                $all: [senderId, receiverId],
                $size: 2
            }
        }).populate('messages');

        if (!conversation) {
            const newConversation = await Conversation.create({
                members: [senderId, receiverId],
                messages: []
            });
            res.status(200).json({
                success: true,
                message: "Conversation created successfully",
                data: newConversation,
            });
            return
        }

        res.status(200).json({
            success: true,
            message: "Messages retrieved successfully",
            data: conversation.messages,
        });
    } catch (error) {
        console.error("Get messages error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve messages. Please try again."
        });
    }
};