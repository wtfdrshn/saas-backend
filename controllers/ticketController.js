const ConcernTicket = require("../models/ConcernTicket.js");
const Event = require('../models/Event.js');

// 1. Create a new ticket (User Side)
const createTicket = async (req, res) => {
    try {
        const { eventId, subject, description } = req.body;
        const userId = req.user.id;

        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ message: "Event not found" });

        const ticket = new ConcernTicket({
            userId,
            eventId,
            organizerId: event.organizer._id,
            subject,
            description,
        });

        await ticket.save();
        res.status(201).json({ success: true, message: "Ticket created successfully", ticket });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error });
    }
};

// 2. Get all tickets for a specific user (User Dashboard)
const getUserTickets = async (req, res) => {
    try {
        const tickets = await ConcernTicket.find({ userId: req.user.id })
            .populate("eventId", "title")
            .populate("organizerId", "name organizationName");
        res.status(200).json({ success: true, tickets });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error fetching tickets", error });
    }
};

// 3. Get all tickets for an organizer (Organizer Dashboard)
const getOrganizerTickets = async (req, res) => {
    try {
        const tickets = await ConcernTicket.find({ organizerId: req.user.id })
            .populate("userId", "name email")
            .populate("eventId", "title");
        res.status(200).json({ success: true, tickets });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error fetching tickets", error });
    }
};

// 4. Update Ticket Status (Organizer resolves issue)
const updateTicketStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const ticket = await ConcernTicket.findByIdAndUpdate(req.params.id, { status }, { new: true });

        if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });

        res.status(200).json({ success: true, message: "Ticket updated", ticket });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error updating ticket", error });
    }
};

module.exports = {
   createTicket,
   getUserTickets,
   updateTicketStatus,
   getOrganizerTickets
}
