import Maid from "../models/Maid.js";

const getISTMinutes = (date: Date): number => {
  // console.log(date.getUTCHours())
  // console.log(date.getUTCMinutes())
  return date.getUTCHours() * 60 + date.getUTCMinutes();
};

const timeToMinutes = (time: string): number => {
  if (!time) return 0;

  const parts = time.trim().split(" ");
  if (parts.length !== 2) return 0;

  const timePart = parts[0];
  const modifier = parts[1] as "AM" | "PM";
  if (!timePart || !modifier) return 0;
  const timeParts = timePart.split(":");
  if (timeParts.length !== 2) return 0;

  const hours = Number(timeParts[0]);
  const minutes = Number(timeParts[1]);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;

  let finalHours = hours;

  if (modifier === "PM" && finalHours !== 12) finalHours += 12;
  if (modifier === "AM" && finalHours === 12) finalHours = 0;

  return finalHours * 60 + minutes;
};

export const getAttendanceStatus = async (maidId: string, checkIn: Date): Promise<"on-time" | "late"> => {
  const availability = await Maid.findById(maidId).select('name email phone start_time');

  if (!availability || !availability.start_time) {
    return "on-time";
  }
  const startMinutes = timeToMinutes(availability.start_time);
  const checkInMinutes = getISTMinutes(checkIn);
  if (checkInMinutes < startMinutes) {
    return "on-time";
  }
  return "late";
};
