import { Request, Response } from 'express';
import AppVersion from '../models/appVersion.js';
import { validationResult } from 'express-validator';
import { sendNotificationToAllUsers } from '../utils/firebase.js';

// Create a new app version
export const createAppVersion = async (req: Request, res: Response): Promise<void> => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() });
            return;
        }
        const { androidVersion, androidVersionCode, iosVersion, iosVersionCode, forceUpdate, androidLink, iosLink, visible } = req.body;
        const appVersion = new AppVersion({
            androidVersion,
            androidVersionCode,
            iosVersion,
            iosVersionCode,
            forceUpdate,
            androidLink,
            iosLink,
            visible
        });
        await appVersion.save();
        await sendNotificationToAllUsers(
            "Update Available 🚀",
            "A new version of the app is available. Please update now."
        );
        res.status(201).json({ message: 'App version created successfully', appVersion });
    } catch (error) {
        console.error('Error creating app version:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get all app versions
export const getAllAppVersions = async (req: Request, res: Response): Promise<void> => {
    try {
        const appVersions = await AppVersion.find().sort({ createdAt: -1 });
        res.status(200).json({ appVersions });
    } catch (error) {
        console.error('Error fetching app versions:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get latest visible app version (for app update check)
export const getLatestAppVersion = async (req: Request, res: Response): Promise<void> => {
    try {
        const appVersion = await AppVersion.findOne({ visible: true }).sort({ createdAt: -1 });

        if (!appVersion) {
            res.status(404).json({ message: 'No app version found' });
            return;
        }

        res.status(200).json({ success: true, data: appVersion });
    } catch (error) {
        console.error('Error fetching latest app version:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Update an app version
export const updateAppVersion = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { androidVersion, androidVersionCode, iosVersion, iosVersionCode, forceUpdate, androidLink, iosLink, visible } = req.body;

        const appVersion = await AppVersion.findById(id);

        if (!appVersion) {
            res.status(404).json({ message: 'App version not found' });
            return;
        }

        if (androidVersion) appVersion.androidVersion = androidVersion;
        if (androidVersionCode) appVersion.androidVersionCode = androidVersionCode;
        if (iosVersion) appVersion.iosVersion = iosVersion;
        if (iosVersionCode) appVersion.iosVersionCode = iosVersionCode;
        if (forceUpdate !== undefined) appVersion.forceUpdate = forceUpdate;
        if (androidLink) appVersion.androidLink = androidLink;
        if (iosLink) appVersion.iosLink = iosLink;
        if (visible !== undefined) appVersion.visible = visible;

        await appVersion.save();
        await sendNotificationToAllUsers(
            "Update Available 🚀",
            "A new version of the app is available. Please update now."
        );
        res.status(200).json({success: true, message: 'App version updated successfully', appVersion });
    } catch (error) {
        console.error('Error updating app version:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Delete an app version
export const deleteAppVersion = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const appVersion = await AppVersion.findByIdAndDelete(id);

        if (!appVersion) {
            res.status(404).json({ message: 'App version not found' });
            return;
        }

        res.status(200).json({ message: 'App version deleted successfully' });
    } catch (error) {
        console.error('Error deleting app version:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
