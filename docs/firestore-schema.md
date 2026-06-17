# Firestore Schema — EcoCycle Buea

## users/{userId}
- id, name, email, phone, role: household|business|collector|recycler|government|admin
- neighborhood, address, photoURL, verified, language, ecoCoinsBalance
- createdAt, updatedAt, lastLoginAt

## households/{householdId}
- userId, membersCount, defaultAddress, preferredPickupTimes, recurringPickup

## businesses/{businessId}
- userId, businessName, registrationNumber, locations[], billingEmail, invoiceStatus

## collectors/{collectorId}
- userId, idVerificationStatus, vehicleType, vehiclePlate, licenseNumber
- currentLocation {lat,lng}, availability, rating, completedJobs, earnings

## recyclers/{recyclerId}
- userId, companyName, materialPreferences[], biddingEnabled, purchaseHistory[]

## governmentAgencies/{agencyId}
- userId, jurisdiction, reportAccessLevel

## pickups/{pickupId}
- requesterId, requesterRole, wasteType, quantityKg, address, neighborhood
- photos[], preferredTime, recurring, status: pending|accepted|active|completed|cancelled
- collectorId, recyclerId, location {lat,lng}, otpCode, price, ecoCoinsAwarded
- createdAt, acceptedAt, completedAt

## smartBins/{binId}
- binCode, location {lat,lng}, neighborhood, wasteType
- fillPercentage, weightKg, status: empty|half_full|nearly_full|full
- batteryLevel, lastServicedAt, autoPickupRequestId

## materials/{materialId}
- sellerId, pickupId, type, quantityKg, qualityGrade, pricePerKg, status
- bids[] {recyclerId, amount, createdAt}

## transactions/{transactionId}
- userId, pickupId, type: service_fee|material_sale|reward_redemption
- amount, currency, status, method, createdAt

## ecoCoins/{entryId}
- userId, points, reason, sourceId, direction: earn|redeem, createdAt

## notifications/{notificationId}
- userId, channel: in_app|email|sms|whatsapp
- title, message, eventType, read, createdAt

## reports/{reportId}
- agencyId/adminId, title, type, dateRange, format, downloadUrl, createdAt

## reviews/{reviewId}
- pickupId, reviewerId, revieweeId, rating, comment, createdAt

## settings/global
- wasteCategories[], pricingRules, rewardsRules, notificationTemplates, regions
