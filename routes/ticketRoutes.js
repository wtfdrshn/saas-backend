const express = require("express");
const { createTicket, getUserTickets, getOrganizerTickets, updateTicketStatus } = require("../controllers/ticketController.js");
const { authorize, protect } = require("../middleware/authMiddleware.js");

const router = express.Router();

router.post("/create", protect, createTicket);
router.get("/user", protect, getUserTickets);
router.get("/organizer", protect, authorize('admin', 'organizer'), getOrganizerTickets);
router.put("/:id", protect, authorize('admin', 'organizer'), updateTicketStatus);

module.exports = router; 
