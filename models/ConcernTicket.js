const mongoose = require("mongoose");

const ConcernTicketSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
  organizerId: { type: mongoose.Schema.Types.ObjectId, ref: "Organizer", required: true },
  subject: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ["Open", "In Progress", "Resolved"], default: "Open" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
});

const ConcernTicket = mongoose.model('ConcernTicket', ConcernTicketSchema);

module.exports = ConcernTicket;

