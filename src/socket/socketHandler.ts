import { Server, Socket } from 'socket.io';
import Booking from '../models/Booking.js';
import Messages from '../models/Messages.js';
import Conversation from '../models/Converstion.js';
import Maid from '../models/Maid.js';

interface IUserSocket {
  userId: string;
  socketId: string;
}

export const activeTimers = new Map<string, NodeJS.Timeout>();

// Function to start timer for a booking
export function startBookingTimer(io: Server, bookingId: string, endTime: Date, booking: Object) {
  try {
    io.to(`booking-${bookingId}`).emit('booking:start', {
      bookingId,
      booking
    });
  } catch (error) {
    console.error('Error starting booking timer:', error);
  }
}

// Function to complete booking
export async function completeBooking(io: Server, bookingId: string) {
  try {
    io.to(`booking:${bookingId}`).emit('booking:completed', {
      bookingId
    });
  } catch (error) {
    console.error('Error completing booking:', error);
  }
}

// Function to extend timer
export function extendBookingTimer(io: Server, bookingId: string, newEndTime: Date, booking: Object) {
  try {
    io.to(`booking:${bookingId}`).emit('booking:extend', {
      bookingId,
      booking
    });
  } catch (error) {
    console.error('Error extending booking timer:', error);
  }
}

export function setupSocketHandlers1(io: Server) {
  let users: IUserSocket[] = [];

  // Add user if not already added
  const addUser = (userId: string, socketId: string) => {
    const existingUser = users.find((user) => user.userId === userId);
    if (!existingUser) {
      users.push({ userId, socketId });
    }
  };

  // Remove user on disconnect
  const removeUser = (socketId: string) => {
    users = users.filter((user) => user.socketId !== socketId);
  };

  // Get user by ID
  const getUser = (userId: string): IUserSocket | undefined => {
    return users.find((user) => user.userId === userId);
  };

  io.on("connection", (socket: Socket) => {

    // Join booking room
    socket.on('booking:join', (bookingId: string) => {
      try {
        socket.join(`booking:${bookingId}`);
        console.log(`User ${socket.id} joined booking room: ${bookingId}`);
      } catch (error) {
        console.error('Error joining booking room:', error);
      }
    });

    // Leave booking room
    socket.on('leave-booking', (bookingId: string) => {
      try {
        socket.leave(`booking-${bookingId}`);
        console.log(`User ${socket.id} left booking room: ${bookingId}`);
      } catch (error) {
        console.error('Error leaving booking room:', error);
      }
    });

    // Add user to socket
    socket.on("AddUserSocket", (userId: string) => {
      if (!userId) return;
      // console.log(" User ID:", userId);
      addUser(userId, socket.id);
      io.emit("getUsers", users);
      // console.log(" Active users:", users);
    });

    // Handle sending a message
    socket.on("sendMessage", async (data: { messagedata: { senderId: string; receiverId: string; message: string } }): Promise<void> => {
      try {
        const { senderId, receiverId, message } = data.messagedata;
        if (!senderId || !receiverId || !message) {
          socket.emit("messageError", { error: "Invalid message data" });
          return;
        }

        // console.log("Receiver ID:", receiverId);

        // Save message in database
        const newMessage = new Messages({
          userId: senderId,
          message,
        });
        const savedMessage = await newMessage.save();

        // Find or create conversation
        let conversation = await Conversation.findOne({
          members: { $all: [senderId, receiverId] },
        });

        if (conversation) {
          await Conversation.findByIdAndUpdate(conversation._id, {
            $push: { messages: savedMessage._id },
          });
        } else {
          conversation = await Conversation.create({
            members: [senderId, receiverId],
            messages: [savedMessage._id],
          });
        }

        // Send message to receiver if connected
        const receiverUser = getUser(receiverId);
        if (receiverUser?.socketId) {
          io.to(receiverUser.socketId).emit("receiveMessage", {
            senderId,
            message,
            messageId: savedMessage._id,
            timestamp: savedMessage.timestamp,
          });
        } else {
          console.log("Receiver not connected");
        }

        // Confirm message sent to sender
        socket.emit("messageSent", {
          messageId: savedMessage._id,
          timestamp: savedMessage.timestamp,
        });
      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit("messageError", { error: "Failed to send message" });
      }
    }
    );

    // Handle disconnect
    socket.on("disconnect", () => {
      console.log(" User disconnected:", socket.id);
      removeUser(socket.id);
      io.emit("getUsers", users);
      // console.log("Remaining users:", users);
    });
  });
  io.engine?.httpServer?.on('request', (req: any, _res: any) => {
    if (!req.app?.get('io')) {
      req.app?.set('io', io);
    }
  });
}

export function setupSocketHandlers(io: Server) {

  io.on("connection", (socket: Socket) => {

    // Join booking room
    socket.on('booking:join', async (bookingId: string) => {
      try {
        socket.join(`booking:${bookingId}`);
        console.log(`User ${socket.id} joined booking room: ${bookingId}`);
        const booking = await Booking.findById({ _id: bookingId })
          .populate('maid_id')
          .populate('service_id')
          .sort({ booking_date: -1 })
        if (!booking) return;
        if (booking.status === 'ongoing') {
          const actual_start_time = new Date(booking.actual_start_time!)
          const now = new Date();
          const diffMs: number = now.getTime() - actual_start_time.getTime();
          const secondsDiff = Math.floor(diffMs / 1000);
          const newSecond = booking.duration_hours - secondsDiff;
          booking.duration_hours = newSecond > 0 ? newSecond : 0;
          booking.extend_time = 0;
          const updatedBooking = booking.toObject();
          console.log("Updated duration:", updatedBooking.duration_hours);
          // await booking.save();

//  const now = new Date();
//       const diffMs: number = now.getTime() - updatedBooking.actual_start_time!.getTime();
//       const secondsDiff = Math.floor(diffMs / 1000);
//       const newSecond = updatedBooking.duration_hours - secondsDiff;
//       updatedBooking.duration_hours = newSecond > 0 ? newSecond : 0;

          // console.log("vikram ", booking)
          io.to(`booking:${booking._id}`).emit('booking:start', {
            bookingId: booking._id,
            booking: booking
          });
          if (booking.duration_hours === 0) {
            booking.status = "completed";
            booking.booking_complete_date = new Date();
            booking.pin = "";
            const maid = await Maid.findById(booking.maid_id)
            if(maid){
              maid.is_booked = false
              await maid.save()
            }
            await booking.save();
          }
        }
      } catch (error) {
        console.error('Error joining booking room:', error);
      }
    });

    // Leave booking room
    socket.on('leave-booking', (bookingId: string) => {
      try {
        socket.leave(`booking-${bookingId}`);
        console.log(`User ${socket.id} left booking room: ${bookingId}`);
      } catch (error) {
        console.error('Error leaving booking room:', error);
      }
    });

  });
  io.engine?.httpServer?.on('request', (req: any, _res: any) => {
    if (!req.app?.get('io')) {
      req.app?.set('io', io);
    }
  });
}

