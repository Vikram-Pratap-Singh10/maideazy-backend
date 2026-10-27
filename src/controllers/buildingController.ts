import XLSX from "xlsx";
import { Request, Response } from 'express';
import Building from '../models/Building.js';

// Get all buildings
export const getAllBuildings = async (req: Request, res: Response): Promise<void> => {
    try {
        const buildings = await Building.find({ isActive: true, pincode: req.params.pincode?.toString() });
        if (buildings.length === 0) {
            res.status(404).json({ success: false, message: "Building not found" })
            return;
        }
        res.status(200).json({ success: true, data: buildings });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
export const getAllHubs = async (req: Request, res: Response): Promise<void> => {
    try {
        const buildings = await Building.find({ isActive: true }).distinct("hub");
        if (buildings.length === 0) {
            res.status(404).json({ success: false, message: "Building not found" })
            return;
        }
        res.status(200).json({ success: true, data: buildings });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
export const getAllHubsForBooking = async (req: Request, res: Response): Promise<void> => {
    try {
        const buildings = await Building.find({ isActive: true });
        if (buildings.length === 0) {
            res.status(404).json({ success: false, message: "Building not found" })
            return;
        }
        res.status(200).json({ success: true, data: buildings });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get building by ID
export const getBuildingById = async (req: Request, res: Response): Promise<void> => {
    try {
        const buildingId = req.params.buildingId;
        const building = await Building.findById(buildingId);
        if (!building) {
            res.status(404).json({ success: false, message: 'Building not found' });
            return;
        }
        res.status(200).json({ success: true, data: building });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Create new building (Admin only)
export const createBuilding = async (req: Request, res: Response): Promise<any> => {
    try {
        const buildingData = req.body;
        const building = await Building.create(buildingData);
        return res.status(201).json({ success: true, data: building });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error creating building' });
    }
};

// Update building (Admin only)
export const updateBuilding = async (req: Request, res: Response): Promise<void> => {
    try {
        const buildingId = req.params.buildingId;
        const updates = req.body;

        const building = await Building.findByIdAndUpdate(buildingId, updates, { new: true });
        if (!building) {
            res.status(404).json({ success: false, message: 'Building not found' });
            return;
        }

        res.status(200).json({ success: true, message: "updated successful", data: building });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error updating building' });
    }
};

// Delete building (Admin only)
export const deleteBuilding = async (req: Request, res: Response): Promise<void> => {
    try {
        const buildingId = req.params.buildingId;
        const building = await Building.findByIdAndUpdate(buildingId, { isActive: false }, { new: true });
        if (!building) {
            res.status(404).json({ success: false, message: 'Building not found' });
            return;
        }
        res.status(200).json({ success: true, message: 'Building deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error deleting building' });
    }
};

// Get All Building (Admin only)
export const getAddBuildingAdmin = async (req: Request, res: Response): Promise<void> => {
    try {
        const buildings = await Building.find({ isActive: true });
        if (buildings.length === 0) {
            res.status(404).json({ success: false, message: "Building not found" })
            return;
        }
        res.status(200).json({ success: true, data: buildings });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Bulk Upload Buildings from Excel/CSV (Admin only)
interface IExcelRow {
    name: string;
    hub: string;
    pincode: string | number;
}

export const bulkUpload = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({ success: false, message: "File is required" });
            return;
        }
        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
            res.status(400).json({ success: false, message: "No sheet found in Excel file" });
            return;
        }
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
            res.status(400).json({ success: false, message: "No sheet found in Excel file" });
            return;
        }
        const rows = XLSX.utils.sheet_to_json<IExcelRow>(sheet, { defval: "" });

        if (!rows.length) {
            res.status(400).json({ success: false, message: "Empty file" });
            return;
        }
        const requiredFields: (keyof IExcelRow)[] = ["name", "hub", "pincode"];

        const validData: { name: string; hub: string; pincode: string; }[] = [];

        const invalidData: { row: number; error: string; }[] = [];

        rows.forEach((row, index) => {
            const missing = requiredFields.filter((field) => !row[field] || String(row[field]).trim() === "");

            if (missing.length) {
                invalidData.push({
                    row: index + 2, // Excel header row = 1
                    error: `Missing fields: ${missing.join(", ")}`
                });
                return;
            }

            validData.push({
                name: String(row.name).trim(),
                hub: String(row.hub).trim(),
                pincode: String(row.pincode).trim()
            });
        });
        if (validData.length > 0) {
            await Building.insertMany(validData, { ordered: false });
        }
        res.status(200).json({ success: true, inserted: validData.length, failed: invalidData.length, errors: invalidData });
    } catch (error: any) {
        console.error("Bulk upload error:", error);
        res.status(500).json({ success: false, message: error.message || "Bulk upload failed" });
    }
};