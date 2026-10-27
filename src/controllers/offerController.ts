import { Request, Response } from 'express';
import Offer from '../models/Offer.js';
import { validationResult } from 'express-validator';
import Service from '../models/Service.js';
import Setting from '../models/Setting.js';

// Get all active offers
export const getAllOffers = async (req: Request, res: Response): Promise<void> => {
    try {
        const offers = await Offer.find({ isActive: true })
        res.json({ success: true, data: offers });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get offer by ID
export const getOfferById = async (req: Request, res: Response): Promise<void> => {
    try {
        const offerId = req.params.offerId;
        const offer = await Offer.findById(offerId)
            .populate('serviceId', 'service_name');
        if (!offer) {
            res.status(404).json({ success: false, message: 'Offer not found' });
            return;
        }
        res.json({ success: true, data: offer });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get offers by service ID
export const getOffersByService = async (req: Request, res: Response): Promise<void> => {
    try {
        const serviceId = req.params.serviceId;
        const offers = await Offer.find({ serviceId, isActive: true });
        res.json({ success: true, data: offers });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Create new offer (Admin only)
export const createOffer = async (req: Request, res: Response): Promise<any> => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

        const offerData = req.body;
        const offer = await Offer.create(offerData);
        return res.status(201).json({ success: true, data: offer });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error creating offer' });
    }
};

// Update offer (Admin only)
export const updateOffer = async (req: Request, res: Response): Promise<void> => {
    try {
        const offerId = req.params.offerId;
        const updates = req.body;

        const offer = await Offer.findByIdAndUpdate(offerId, updates, { new: true })
            .populate('serviceId', 'service_name');
        if (!offer) {
            res.status(404).json({ success: false, message: 'Offer not found' });
            return;
        }

        res.json({ success: true, data: offer });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error updating offer' });
    }
};

// Delete offer (Admin only - soft delete by setting isActive to false)
export const deleteOffer = async (req: Request, res: Response): Promise<void> => {
    try {
        const offerId = req.params.offerId;

        const offer = await Offer.findByIdAndUpdate(
            offerId,
            { isActive: false },
            { new: true }
        );

        if (!offer) {
            res.status(404).json({ success: false, message: 'Offer not found' });
            return;
        }

        res.json({ success: true, message: 'Offer deactivated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error deleting offer' });
    }
};

// Apply offer to service (calculate discounted price)
export const applyOfferToService = async (req: Request, res: Response): Promise<void> => {
    try {
        const { serviceId, offerId, duration } = req.body;

        const service = await Service.findById(serviceId);
        if (!service) {
            res.status(404).json({ success: false, message: 'Service not found' });
            return;
        }
        const offer = await Offer.findById(offerId);
        if (!offer || !offer.isActive) {
            res.status(404).json({ success: false, message: 'Offer not found or inactive' });
            return;
        }

        let discountedPrice = service.discountAmount;

        if (offer.discountPercent) {
            discountedPrice -= (discountedPrice * offer.discountPercent) / 100;
        } else if (offer.flatPrice) {
            discountedPrice = offer.flatPrice;
        }

        res.json({
            success: true,
            data: { originalPrice: service.discountAmount, discountedPrice, offerApplied: offer.title }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error applying offer' });
    }
};


export const getNewUserOffer = async (req: Request, res: Response): Promise<void> => {
  try {
    const offer = await Offer.findOne({isActive:true, type: "onlyNew" });
    if (!offer) {
      res.status(404).json({ success: false, message: "Offer not found" });
      return;
    }

    const setting = await Setting.findOne({});
    const gstPercentage = setting?.gstPercentage || 0;

    const bookingsLimit = offer.conditions?.bookingsLimit || 0;
    const perBookingDuration = offer.conditions?.perBookingDuration || 0;
    const flatPrice = offer.flatPrice || 0;

    const durationInMinutes = perBookingDuration * 60;

    const expiryDate = new Date(Date.now() + 5 * 60 * 60 * 1000); // 5 hours later

    const offerTax = flatPrice * (gstPercentage / 100);
    const offerTotalPrice = flatPrice + offerTax;

    const newOffer = {
      offer_total_price: offerTotalPrice,
      offer_original_price: flatPrice,
      offer_tax: offerTax,
      offer_title: `FIRST ${bookingsLimit} BOOKINGS`,
      offer_sub_title: bookingsLimit
        ? `FOR ₹${flatPrice / bookingsLimit} EACH`
        : `FOR ₹0 EACH`,
      offer_duration: `${perBookingDuration} hrs booking by day only`,
      offer_expiryTime: expiryDate.toISOString(),
      offer_validity: `${offer.conditions?.validityDays || 0}-Days Validity`,
      offer_booking_count: bookingsLimit
    };

    res.status(200).json({ success: true, data: newOffer });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};