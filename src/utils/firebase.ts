import admin from "firebase-admin";
import User from "../models/User.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Notification from "../models/Notification.js";
import appVersion from "../models/appVersion.js";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")!,
    }),
  });
}


// export const sendNotificationToAdmins1 = async (title: string, body: string, data?: Record<string, string>) => {
//   try {
//     const admins = await User.find({ role: "admin" }).select("fcmToken pushTokens");
//     const tokens: string[] = [];
//     admins.forEach(adminUser => {
//       if (adminUser.fcmToken) tokens.push(adminUser.fcmToken);
//       adminUser.pushTokens?.forEach(t => {
//         if (t.fcmToken) tokens.push(t.fcmToken);
//       });
//     });

//     if (!tokens.length) return;
//     const message: admin.messaging.MulticastMessage = {
//       notification: { title, body },
//       data: data ?? {},
//       tokens,
//     };
//     if (data) {
//       await Notification.create({
//         message: body,
//         role: 'admin',
//         sender: data.userId,
//         entityId: data.bookingId,
//         type: data.type
//       })
//     }
//     // console.log(message)
//     await admin.messaging().sendEachForMulticast(message);
//   } catch (err) {
//     console.error("FCM error:", err);
//   }
// };

export const sendNotificationToAdmins = async (title: string, body: string, data?: Record<string, string>) => {
  try {
    const admins = await User.findOne({ role: "admin" }).select("fcmToken pushTokens role");

    const tokenSet = new Set<string>();

    // admins.forEach(admin => {
    if (admins?.fcmToken) tokenSet.add(admins.fcmToken);
    // admin.pushTokens?.forEach(t => {
    //   if (t?.fcmToken) tokenSet.add(t.fcmToken);
    // });
    // });

    const tokens = Array.from(tokenSet);
    if (!tokens.length) return;

    const message: admin.messaging.MulticastMessage = {
      notification: { title, body },
      data: data ?? {},
      tokens,
    };

    // ✅ Save ONE notification for ADMIN role
    if (data) {
      await Notification.create({
        message: body,
        role: "admin",
        sender: data.userId,
        entityId: data.bookingId,
        type: data.type,
      });
    }
    await admin.messaging().sendEachForMulticast(message);
  } catch (err) {
    console.error("FCM error:", err);
  }
};
// maid booking accept or reject
export const sendNotificationBookingToAdmin = async (title: string, body: string, data?: Record<string, string>) => {
  try {
    const admins = await User.findOne({ role: "admin" }).select("fcmToken pushTokens");
    const user = await User.findOne({ role: "admin" }).select("fullName");
    const tokens: string[] = [];
    // admins.forEach(adminUser => {
    if (admins?.fcmToken) tokens.push(admins.fcmToken);
    //   adminUser.pushTokens?.forEach(t => {
    //     if (t.fcmToken) tokens.push(t.fcmToken);
    //   });
    // });

    if (!tokens.length) return;
    const message: admin.messaging.MulticastMessage = {
      notification: { title, body },
      data: data ?? {},
      tokens,
    };
    if (user && data) {
      await Notification.create({
        message: body,
        recipient: user._id.toString(),
        sender: data.userId,
        entityId: data.bookingId,
        type: data.type
      })
    }
    // console.log(message)
    await admin.messaging().sendEachForMulticast(message);
  } catch (err) {
    console.error("FCM error:", err);
  }
};

interface SendNotificationParams {
  receiverRole: "maid" | "user";
  receiverId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}
// after notification implement
export const sendNotification = async ({ receiverRole, receiverId, title, body, data, }: SendNotificationParams) => {
  try {
    const query = receiverRole === "maid" ? { role: "maid", maidId: receiverId }
      : { role: "user", _id: receiverId };

    const users = await User.find(query).select("fcmToken pushTokens");

    const tokens: string[] = [];

    users.forEach((user) => {
      if (user.fcmToken) tokens.push(user.fcmToken);
      user.pushTokens?.forEach((t) => {
        if (t.fcmToken) tokens.push(t.fcmToken);
      });
    });

    if (!tokens.length) return;

    const message: admin.messaging.MulticastMessage = {
      notification: { title, body },
      data: data ?? {},
      tokens,
    };

    // ✅ Save notification in DB
    const notificationData: any = {
      title,
      message: body,
      type: data?.type,
      entityId: data?.bookingId,
      sender: data?.userId,
    };
    if (receiverRole === "user") {
      notificationData.recipient = receiverId;
    }
    if (receiverRole === "maid") {
      notificationData.maid_id = receiverId;
    }
    await Notification.create(notificationData);


    await admin.messaging().sendEachForMulticast(message);

  } catch (err) {
    console.error("FCM error:", err);
  }
};

export const sendNotificationToUser = async (userId: string, title: string, body: string, data?: Record<string, string>) => {
  try {
    // console.log("user notification")
    const user = await User.findById(userId).select("fcmToken pushTokens");
    if (!user) return;

    const tokenSet = new Set<string>();

    // user.pushTokens?.forEach(t => {
    if (user?.fcmToken) tokenSet.add(user.fcmToken);
    // });
    // console.log("token" + tokenSet)
    const tokens = Array.from(tokenSet);
    if (!tokens.length) return;

    const stringData = data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : {};

    const message: admin.messaging.MulticastMessage = {
      notification: { title, body },
      data: stringData,
      tokens,
    };
    // console.log("message" + message)
    // Save notification for USER
    if (data) {
      await Notification.create({
        message: body,
        role: "user",
        sender: data.userId ?? null,
        entityId: data.bookingId ?? null,
        type: data.type ?? "general",
      });
    }

    await admin.messaging().sendEachForMulticast(message);
  } catch (err) {
    console.error("FCM error:", err);
  }
};

export const sendNotificationToMaid = async (userId: string, title: string, body: string, data?: Record<string, string>) => {
  try {
    // console.log("maid notification")
    const user = await User.findOne({ maidId: userId }).select("fcmToken pushTokens");
    if (!user) return;

    const tokenSet = new Set<string>();

    // user.pushTokens?.forEach(t => {
    if (user?.fcmToken) tokenSet.add(user.fcmToken);
    // });
    // console.log("token" + tokenSet)
    const tokens = Array.from(tokenSet);
    if (!tokens.length) return;

    const stringData = data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : {};

    const message: admin.messaging.MulticastMessage = {
      notification: { title, body },
      data: stringData,
      tokens,
    };
    // console.log("message" + message)
    // Save notification for USER
    if (data) {
      await Notification.create({
        message: body,
        role: "maid",
        sender: data.userId ?? null,
        entityId: data.bookingId ?? null,
        type: data.type ?? "general",
      });
    }

    await admin.messaging().sendEachForMulticast(message);
  } catch (err) {
    console.error("FCM error:", err);
  }
};

// app version update notification
export const sendNotificationToAllUsers = async (title: string, body: string, data?: Record<string, string>) => {
  try {
    // Get users with valid fcmToken only
    const users = await User.find({ fcmToken: { $exists: true, $nin: [null, ""] } }).select("fcmToken");

    // Extract tokens
    const tokens = users.map(user => user.fcmToken).filter((t): t is string => !!t && t.trim() !== "");

    if (!tokens.length) {
      console.log("No FCM tokens found");
      return;
    }

    // Convert data to string
    const stringData = data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : {};

    // FCM limit = 500 tokens per request
    const chunkSize = 500;

    for (let i = 0; i < tokens.length; i += chunkSize) {
      const chunk = tokens.slice(i, i + chunkSize);

      const message: admin.messaging.MulticastMessage = {
        notification: { title, body },
        data: stringData,
        tokens: chunk,
      };

      const response = await admin.messaging().sendEachForMulticast(message);

      // Handle invalid tokens
      response.responses.forEach((res, idx) => {
        if (!res.success) {
          console.log("Invalid token:", chunk[idx]);
          // Optional: remove from DB
        }
      });
    }

    // Save notification
    // await Notification.create({
    //   message: body,
    //   role: "user",
    //   type: "app_update",
    // });

    console.log(" Notification sent to all users");

  } catch (err) {
    console.error("FCM broadcast error:", err);
  }
};

// cron job run for app version
export const sendAppUpdateNotification = async () => {
  try {
    // console.log("calllling")
    const version = await appVersion.findOne();

    if (!version) {
      console.log("App version config not found");
      return;
    }

    // Get only required fields
    const users = await User.find({
      fcmToken: { $exists: true, $nin: [null, ""] },
      isActive: true,
      isBlock: false,
    }).select("fcmToken deviceType appVersionCode fullName");

    if (!users.length) {
      console.log("No users found");
      return;
    }

    const ANDROID_LINK = "https://play.google.com/store/apps/details?id=com.creatamaxinfotech.maideazy";
    const IOS_LINK = "https://apps.apple.com/in/app/maideazy/id6757801453";

    const androidTokens: string[] = [];
    const iosTokens: string[] = [];

    // 🔍 Filter outdated users
    for (const user of users) {
      if (
        user.deviceType === "android" &&
        version.androidVersionCode &&
        user.appVersionCode < version.androidVersionCode
      ) {
        console.log(user.fullName)
        androidTokens.push(user.fcmToken);
      }

      if (
        user.deviceType === "ios" &&
        version.iosVersionCode &&
        user.appVersionCode < version.iosVersionCode
      ) {
        iosTokens.push(user.fcmToken);
      }
    }

    if (!androidTokens.length && !iosTokens.length) {
      console.log("No outdated users found");
      return;
    }

    const chunkSize = 500;

    // 🔔 Send Android Notifications
    for (let i = 0; i < androidTokens.length; i += chunkSize) {
      const chunk = androidTokens.slice(i, i + chunkSize);

      await admin.messaging().sendEachForMulticast({
        tokens: chunk,
        notification: {
          title: "Update Required 🚀",
          body: "A new version is available. Update now for better experience.",
        },
        data: {
          link: ANDROID_LINK,
          type: "app_update"
        },
      });
    }

    // 🔔 Send iOS Notifications
    for (let i = 0; i < iosTokens.length; i += chunkSize) {
      const chunk = iosTokens.slice(i, i + chunkSize);

      await admin.messaging().sendEachForMulticast({
        tokens: chunk,
        notification: {
          title: "Update Required 🚀",
          body: "A new version is available. Update now for better experience.",
        },
        data: {
          link: IOS_LINK,
          type: "app_update"
        },
      });
    }

    // Save notification log
    // await Notification.create({
    //   message: "App update notification sent",
    //   role: "user",
    //   type: "app_update",
    // });

    console.log(`✅ Sent to Android: ${androidTokens.length}, iOS: ${iosTokens.length}`);

  } catch (err) {
    console.error("FCM update notification error:", err);
  }
};



export const sendNotification1 = async (token: any, title: any, body: any) => {
  const message = {
    notification: {
      title: title,
      body: body
    },
    token: token
  };
  try {
    // console.log(message)
    const response = await admin.messaging().send(message);
    console.log('Successfully sent message:', response);
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

export default admin;
