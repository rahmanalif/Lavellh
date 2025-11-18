# Booking System Examples

## Understanding the Two Booking Types

### 📋 Type 1: Regular Booking (appointmentEnabled = false)

**Use Case:** Simple service booking where user just needs to select a date and make a down payment.

**Example Service:**
```json
{
  "_id": "service123",
  "headline": "House Cleaning Service",
  "appointmentEnabled": false,
  "basePrice": 120
}
```

**What User Does:**
1. Views service (GET /api/services/service123)
2. Sees it's a regular service (appointmentEnabled = false)
3. Creates booking with:
   - Date: When they want the service
   - Down payment: At least $24 (20% of $120)
   - Notes: Any special instructions

**Example Request:**
```javascript
// POST /api/bookings
{
  "serviceId": "service123",
  "bookingDate": "2025-01-25",
  "downPayment": 100,
  "userNotes": "Please come in the morning"
}

// Calculation:
// Total: $120
// Down payment: $100 (83% - more than 20% minimum)
// Remaining: $20
// Status: "partial" (because some payment made, but not full)
```

---

### 📅 Type 2: Appointment Booking (appointmentEnabled = true)

**Use Case:** Time-based service booking where provider offers different time slots with different prices.

**Example Service:**
```json
{
  "_id": "service456",
  "headline": "Professional Massage",
  "appointmentEnabled": true,
  "appointmentSlots": [
    {
      "_id": "slot1",
      "duration": 1,
      "durationUnit": "hours",
      "price": 60
    },
    {
      "_id": "slot2",
      "duration": 2,
      "durationUnit": "hours",
      "price": 120
    },
    {
      "_id": "slot3",
      "duration": 3,
      "durationUnit": "hours",
      "price": 150
    }
  ]
}
```

**What User Does:**
1. Views service (GET /api/services/service456)
2. Sees it has appointments enabled
3. Checks available time slots for a specific date
4. Selects a slot (e.g., 2 hours for $120)
5. Chooses their preferred time window (e.g., 9:00 AM to 5:00 PM)
6. Creates appointment

**Example Request:**
```javascript
// Step 1: Check available slots
// GET /api/appointments/available-slots/service456?date=2025-01-25

// Response shows:
{
  "bookedSlots": [
    { "startTime": "10:00", "endTime": "12:00" },  // Already booked
    { "startTime": "14:00", "endTime": "16:00" }   // Already booked
  ]
}

// Step 2: Create appointment (avoiding booked times)
// POST /api/appointments
{
  "serviceId": "service456",
  "appointmentDate": "2025-01-25",
  "timeSlot": {
    "startTime": "09:00",  // 9:00 AM
    "endTime": "17:00"     // 5:00 PM (provider's available time)
  },
  "slotId": "slot2",  // The 2-hour slot
  "downPayment": 50,
  "userNotes": "Prefer morning session if possible"
}

// Calculation:
// Total: $120 (from slot2 price)
// Down payment: $50 (optional, not required for appointments)
// Remaining: $70
// Status: "partial"
```

---

## Real-World Example Flows

### Example 1: User Books a House Cleaning Service

```javascript
// Service doesn't need specific appointment times
const service = {
  headline: "Deep House Cleaning",
  appointmentEnabled: false,
  basePrice: 150
};

// User creates booking
const booking = {
  serviceId: service._id,
  bookingDate: "2025-01-28",
  downPayment: 30,  // 20% of $150 = minimum required
  userNotes: "3 bedroom apartment, need deep cleaning"
};

// Response:
{
  "totalAmount": 150,
  "downPayment": 30,
  "remainingAmount": 120,
  "paymentStatus": "partial",
  "bookingStatus": "pending"
}
```

### Example 2: User Books a Spa Appointment

```javascript
// Service has time-based slots
const service = {
  headline: "Luxury Spa Treatment",
  appointmentEnabled: true,
  appointmentSlots: [
    { _id: "slot1", duration: 30, durationUnit: "minutes", price: 50 },
    { _id: "slot2", duration: 1, durationUnit: "hours", price: 80 },
    { _id: "slot3", duration: 2, durationUnit: "hours", price: 140 }
  ]
};

// User wants 2-hour treatment
const appointment = {
  serviceId: service._id,
  appointmentDate: "2025-01-30",
  timeSlot: {
    startTime: "10:00",  // Available from 10 AM
    endTime: "18:00"     // Until 6 PM
  },
  slotId: "slot3",  // 2-hour slot
  downPayment: 70,
  userNotes: "First time customer, any recommendations?"
};

// Response:
{
  "totalAmount": 140,
  "downPayment": 70,
  "remainingAmount": 70,
  "paymentStatus": "partial",
  "appointmentStatus": "pending",
  "selectedSlot": {
    "duration": 2,
    "durationUnit": "hours",
    "price": 140
  }
}
```

---

## Common Questions

### Q: What's the difference between timeSlot and selectedSlot?

**A:**
- `timeSlot` = The time window when the provider is available (e.g., 9 AM to 5 PM)
- `selectedSlot` = The duration/package user selected (e.g., 2-hour service for $120)

Think of it like this:
- Provider says: "I'm available from 9 AM to 5 PM" (timeSlot)
- User says: "I want the 2-hour package" (selectedSlot)
- The actual 2-hour session will happen sometime between 9 AM and 5 PM

### Q: Why do I need to provide both appointmentDate and timeSlot?

**A:**
- `appointmentDate` = Which day (e.g., January 25, 2025)
- `timeSlot` = What time range on that day (e.g., 9:00 AM to 5:00 PM)

### Q: How does conflict detection work?

**A:** The system checks if your requested time window overlaps with any existing confirmed appointments. For example:

```
Your request: 9:00 AM - 5:00 PM
Existing appointment: 10:00 AM - 12:00 PM

Result: CONFLICT ❌ (10-12 PM overlaps with 9 AM-5 PM)
```

To avoid conflicts:
1. Check available slots first: GET /api/appointments/available-slots/serviceId?date=2025-01-25
2. Choose a time window that doesn't overlap with booked slots

### Q: What happens to the service data if the provider changes the price later?

**A:** The system creates a `serviceSnapshot` that preserves the original service details (name, price, photo) at the time of booking. This ensures your booking reflects the price you agreed to, even if the provider updates the service later.

---

## Testing Checklist

### Test Regular Booking:
- [ ] Create booking with valid data
- [ ] Try booking with less than 20% down payment (should fail)
- [ ] Try booking a service that has appointments enabled (should fail)
- [ ] Try booking with past date (should fail)
- [ ] View my bookings
- [ ] Cancel a booking
- [ ] Try to cancel someone else's booking (should fail)

### Test Appointments:
- [ ] Create appointment with valid data
- [ ] Check available slots for a specific date
- [ ] Try creating appointment at already booked time (should fail)
- [ ] Try appointment with invalid time format (should fail)
- [ ] Try appointment with endTime before startTime (should fail)
- [ ] View my appointments
- [ ] Cancel an appointment

---

## API Endpoints Summary

### Regular Bookings:
```
POST   /api/bookings              - Create booking
GET    /api/bookings/my-bookings  - Get my bookings
GET    /api/bookings/:id          - Get single booking
PATCH  /api/bookings/:id/cancel   - Cancel booking
```

### Appointments:
```
POST   /api/appointments                         - Create appointment
GET    /api/appointments/my-appointments         - Get my appointments
GET    /api/appointments/available-slots/:id     - Check available slots
GET    /api/appointments/:id                     - Get single appointment
PATCH  /api/appointments/:id/cancel              - Cancel appointment
```

### Services (Already existing):
```
GET    /api/services                            - Get all services
GET    /api/services/category/:categoryId       - Get services by category
GET    /api/services/:id                        - Get single service
```
