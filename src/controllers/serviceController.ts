import { Request, Response } from 'express';
import Service from '../models/Service.js';
import { validationResult } from 'express-validator';
import Booking from '../models/Booking.js';
import ServicePriceOverride from '../models/ServicePriceOverride.js';
import Setting from '../models/Setting.js';

interface IServicePriceOverride {
  date?: Date;
  pincode?: string;
  servicePricePerMinute: number;
  demoServicePricePerMinute: number;
  is_active: boolean;
}

export const getAllServicesWithOfferApply1 = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get all active services
    const services = await Service.find({ is_active: true })
      .select('_id service_name description type discountAmount originalPrice discountAmount duration total_amount');

    // Apply offer to each service
    const servicesWithPricing = services.map(service => {
      const serviceObj = service.toObject();

      return {
        ...serviceObj,
        pricing: {
          originalPrice: service.originalPrice,
          discountAmount: service.discountAmount,
          discountedPrice: (service.originalPrice - service.discountAmount),
          hasOffer: true,
          offerTitle: null,
          discountPercent: 0
        }
      };
    });
    res.status(200).json({ success: true, data: servicesWithPricing });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
export const getAllServicesWithOfferApply2 = async (req: Request, res: Response): Promise<void> => {
  try {
    //  const userId = (req as any).user._id;
    const { date } = req.query;
    const setting = await Setting.findOne();
    console.log("service date coming" + date)
    let servicePrice = 1.5;
    let demoServicePrice = 1.8;

    if (setting) {
      servicePrice = setting.servicePricePerMinute;
      demoServicePrice = setting.demoServicePricePerMinute;
    }
    if (date) {
      const override = await ServicePriceOverride.findOne({
        date: new Date(date as string)
      }).lean();

      if (override) {
        servicePrice = override.servicePricePerMinute;
        demoServicePrice = override.demoServicePricePerMinute;
      }
    }
    const services = await Service.find({ is_active: true }).select("_id service_name description type duration").sort({ duration: 1 }).lean();

    const servicesWithPricing = services.map(service => {

      const durationHours = service.duration ?? 0;

      const durationMinutes = durationHours * 60;

      const originalPrice = Math.round(durationMinutes * demoServicePrice);
      const discountAmount = Math.round(durationMinutes * servicePrice);
      const discountedPrice = Math.round(originalPrice - discountAmount);

      return {
        ...service,
        pricing: {
          originalPrice,
          discountAmount,
          discountedPrice,
          hasOffer: true,
          offerTitle: null,
          discountPercent: 0
        }
      };
    });

    res.status(200).json({ success: true, data: servicesWithPricing });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });

  }
};
// Get all services with date and pincode override applied
export const getAllServicesWithOfferApply = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date, pincode } = req.query;

    console.log("service date coming:", date, "pincode:", pincode);

    /* 1. Default pricing from settings */
    const setting = await Setting.findOne();

    let servicePrice = setting?.servicePricePerMinute ?? 1.5;
    let demoServicePrice = setting?.demoServicePricePerMinute ?? 1.8;

    /* 2. Prepare date */
    // let selectedDate: Date | null = null;
    // if (date) {
    //   selectedDate = new Date(date as string);
    //   selectedDate.setHours(0, 0, 0, 0); // IMPORTANT
    // }
    // let startOfDay: Date | null = null;
    // let endOfDay: Date | null = null;

    // if (date) {
    //   startOfDay = new Date(date as string);
    //   startOfDay.setUTCHours(0, 0, 0, 0);

    //   endOfDay = new Date(date as string);
    //   endOfDay.setUTCHours(23, 59, 59, 999);
    // }

    /* ✅ Default to current date if not provided */
    const selectedDate = date ? new Date(date as string) : new Date();

    const startOfDay = new Date(selectedDate);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(selectedDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    /* 3. Find overrides (all possible) */
    // let overrides: IServicePriceOverride[] = [];
    let overrides: any[] = [];

    // if (date || pincode) {
    //   overrides = await ServicePriceOverride.find({
    //     is_active: true,
    //     $or: [
    //       { date: { $gte: startOfDay, $lte: endOfDay }, pincode },

    //       { date: { $gte: startOfDay, $lte: endOfDay }, pincode: { $in: [null, undefined] } },

    //       { pincode, date: { $in: [null, undefined] } }
    //     ]
    //   }).lean();
    // }
    overrides = await ServicePriceOverride.find({
      is_active: true,
      $or: [
        // Highest priority: date + pincode
        {
          date: { $gte: startOfDay, $lte: endOfDay },
          pincode
        },

        // Medium: date only
        {
          date: { $gte: startOfDay, $lte: endOfDay },
          pincode: { $in: [null, undefined] }
        },

        // Low: pincode only
        {
          pincode,
          date: { $in: [null, undefined] }
        }
      ]
    }).lean();
    console.log("found overrides:", overrides);
    /* 4. Apply priority logic */
    // let finalOverride: IServicePriceOverride | null = null;
    // let finalOverride: IServicePriceOverride | null = null;
    let finalOverride: any;
    let highestPriority = 0;

    overrides.forEach(o => {
      let priority = 0;

      if (o.date && o.pincode) priority = 3;
      else if (o.pincode) priority = 2;
      else if (o.date) priority = 1;

      if (priority > highestPriority) {
        highestPriority = priority;
        finalOverride = o;
      }
    });

    /* 5. Apply override if exists */
    if (finalOverride) {
      servicePrice = finalOverride.servicePricePerMinute;
      demoServicePrice = finalOverride.demoServicePricePerMinute;
    }
    console.log(servicePrice, demoServicePrice, "final")
    /* 6. Get services */
    const services = await Service.find({ is_active: true })
      .select("_id service_name description type duration")
      .sort({ duration: 1 })
      .lean();

    /* 7. Calculate pricing */
    const servicesWithPricing = services.map(service => {
      const durationHours = service.duration ?? 0;
      const durationMinutes = durationHours * 60;

      const originalPrice = Math.round(durationMinutes * demoServicePrice);
      const discountAmount = Math.round(durationMinutes * servicePrice);
      const discountedPrice = Math.round(originalPrice - discountAmount);

      const discountPercent =
        originalPrice > 0
          ? Math.round((discountAmount / originalPrice) * 100)
          : 0;

      return {
        ...service,
        pricing: {
          originalPrice,
          discountAmount,
          discountedPrice,
          hasOffer: discountAmount > 0,
          offerTitle: discountAmount > 0 ? "Special Offer" : null,
          discountPercent
        }
      };
    });

    res.status(200).json({
      success: true,
      data: servicesWithPricing
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};


// Get all active services
export const getAllServices = async (req: Request, res: Response): Promise<void> => {
  try {
    const services = await Service.find({ is_active: true })
      .select('_id service_name description type discountAmount originalPrice duration total_amount').sort({ duration: -1 });
    res.json({ success: true, data: services });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
// Get service by ID
export const getServiceById = async (req: Request, res: Response): Promise<void> => {
  try {
    const serviceId = req.params.serviceId;
    const service = await Service.findById(serviceId);
    if (!service) {
      res.status(404).json({ success: false, message: 'Service not found' });
      return;
    }
    res.json({ success: true, data: service });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Create new service (Admin only - would need admin middleware)
export const createService = async (req: Request, res: Response): Promise<any> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { service_name, type, description, originalPrice, discountAmount, duration } = req.body;
    // const total_amount = await (discountAmount * duration)
    const service = await Service.create({
      service_name,
      type,
      duration,
      originalPrice,
      discountAmount,
      // total_amount,
      description: description || null,
      is_active: true
    });

    return res.status(201).json({ success: true, data: service });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error creating service' });
  }
};

// Update service (Admin only)
export const updateService = async (req: Request, res: Response): Promise<void> => {
  try {
    const serviceId = req.params.serviceId;
    const existService = await Service.findById(serviceId);
    if (!existService) {
      res.status(404).json({ success: false, message: 'Service not found' });
      return;
    }
    // req.body.total_amount = await ((req.body.discountAmount || existService.discountAmount) * (req.body.duration || existService.duration));
    const service = await Service.findByIdAndUpdate(serviceId, req.body, { new: true });
    if (!service) {
      res.status(404).json({ success: false, message: 'Service not found' });
      return;
    }

    res.json({ success: true, data: service });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error updating service' });
  }
};

// Delete service (Admin only - soft delete by setting is_active to false)
export const deleteService = async (req: Request, res: Response): Promise<void> => {
  try {
    const serviceId = req.params.serviceId;

    const service = await Service.findByIdAndUpdate(
      serviceId,
      { is_active: false },
      { new: true }
    );

    if (!service) {
      res.status(404).json({ success: false, message: 'Service not found' });
      return;
    }

    res.json({ success: true, message: 'Service deactivated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error deleting service' });
  }
};

export const viewAllServices = async (req: Request, res: Response): Promise<any> => {
  try {
    const { type } = req.query;
    let filter: any = { is_active: true };
    if (type) filter.type = type;
    const services = await Service.find(filter)
      .select('_id service_name description type discountAmount originalPrice duration total_amount is_active').sort({ total_amount: 1 });
    if (services.length === 0) {
      return res.status(404).json({ success: false, message: "Services Not Found" });
    }

    // ✅ Count bookings for each service
    const servicesWithCount = await Promise.all(
      services.map(async (service) => {
        const bookingCount = await Booking.countDocuments({ service_id: service._id });
        return {
          ...service.toObject(),
          bookingCount
        };
      })
    );
    return res.status(200).json({ success: true, data: servicesWithCount });
  } catch (error) {
    console.error("Error in viewAllServices:", error);
    return res.status(500).json({ success: false, message: 'Internal Server error' });
  }
};

