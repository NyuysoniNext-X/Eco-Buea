# Node Backend Data Model

The current MVP stores these resources in `data/db.json`:

- users
- pickups
- smartBins
- materials
- notifications

Recommended production database tables/collections:

## users
id, name, email, phone, role, neighborhood, address, ecoCoinsBalance, verified, createdAt

## pickups
id, requesterId, requester, wasteType, quantityKg, neighborhood, address, preferredTime, status, collectorId, otpCode, photos, ecoCoinsAwarded, createdAt, acceptedAt, completedAt

## smart_bins
id, binCode, neighborhood, latitude, longitude, wasteType, fillPercentage, weightKg, status, batteryLevel, lastServicedAt

## materials
id, sellerId, pickupId, type, quantityKg, grade, pricePerKg, status, createdAt

## bids
id, materialId, recyclerId, amount, status, createdAt

## notifications
id, userId, title, message, channel, eventType, read, createdAt

## transactions
id, userId, pickupId, type, amount, currency, status, createdAt

## reviews
id, pickupId, reviewerId, revieweeId, rating, comment, createdAt
