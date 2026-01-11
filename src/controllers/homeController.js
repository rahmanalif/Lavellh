const Provider = require('../models/Provider');
const Service = require('../models/Service');
const Review = require('../models/Review');
const User = require('../models/User');
const Event = require('../models/Event');

/**
 * Get featured providers for home page
 * GET /api/home/featured-providers
 * Query params:
 *   - latitude: User's current latitude
 *   - longitude: User's current longitude
 *   - maxDistance: Maximum distance in meters (optional, default: 50000 = 50km)
 *   - limit: Number of providers to return (optional, default: 20)
 */
exports.getFeaturedProviders = async (req, res) => {
  try {
    const {
      latitude,
      longitude,
      maxDistance = 50000, // 50km default
      limit = 20
    } = req.query;

    // Validate coordinates
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const userLat = parseFloat(latitude);
    const userLon = parseFloat(longitude);

    if (isNaN(userLat) || isNaN(userLon)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid latitude or longitude'
      });
    }

    // Get current date to filter expired paid providers
    const now = new Date();

    // Find all paid providers who are verified and active
    const paidProviders = await Provider.find({
      isPaidForHomeScreen: true,
      $or: [
        { paidHomeScreenExpiresAt: null },
        { paidHomeScreenExpiresAt: { $gt: now } }
      ],
      verificationStatus: 'verified',
      isAvailable: true
    }).populate({
      path: 'userId',
      select: 'fullName email phoneNumber profilePicture location'
    });

    // Calculate distance for each provider and add to results
    const providersWithDistance = paidProviders
      .map(provider => {
        const providerUser = provider.userId;

        if (!providerUser || !providerUser.location ||
            !providerUser.location.coordinates ||
            providerUser.location.coordinates.length !== 2) {
          return null; // Skip providers without valid location
        }

        const [providerLon, providerLat] = providerUser.location.coordinates;

        // Calculate distance using Haversine formula (in meters)
        const distance = calculateDistance(
          userLat,
          userLon,
          providerLat,
          providerLon
        );

        return {
          provider,
          distance,
          providerUser
        };
      })
      .filter(item => item !== null && item.distance <= maxDistance);

    // Sort by distance (closest first)
    providersWithDistance.sort((a, b) => a.distance - b.distance);

    // Limit results
    const limitedProviders = providersWithDistance.slice(0, parseInt(limit));

    // Fetch services and reviews for each provider
    const providersWithDetails = await Promise.all(
      limitedProviders.map(async ({ provider, distance, providerUser }) => {
        // Get services for this provider
        const services = await Service.find({
          providerId: provider._id,
          isActive: true
        })
          .select('servicePhoto headline description basePrice appointmentEnabled appointmentSlots rating totalReviews category')
          .populate('category', 'name icon')
          .limit(5); // Limit to 5 services per provider

        // Get recent reviews
        const reviews = await Review.find({
          providerId: provider._id,
          isActive: true
        })
          .populate('userId', 'fullName profilePicture')
          .sort({ createdAt: -1 })
          .limit(3); // Get 3 most recent reviews

        return {
          providerId: provider._id,
          name: providerUser.fullName,
          profileImage: providerUser.profilePicture,
          address: providerUser.location?.address || 'Address not available',
          distance: Math.round(distance), // Round to nearest meter
          distanceKm: (distance / 1000).toFixed(2), // Convert to km
          activityTime: provider.activityTime || 'Not specified',
          rating: provider.rating,
          totalReviews: provider.totalReviews,
          completedJobs: provider.completedJobs,
          isAvailable: provider.isAvailable,
          occupation: provider.occupation,
          services: services.map(service => ({
            serviceId: service._id,
            serviceName: service.headline,
            serviceDetail: service.description,
            servicePhoto: service.servicePhoto,
            category: service.category,
            basePrice: service.basePrice,
            appointmentEnabled: service.appointmentEnabled,
            appointmentSlots: service.appointmentSlots,
            rating: service.rating,
            totalReviews: service.totalReviews
          })),
          reviews: reviews.map(review => ({
            reviewId: review._id,
            rating: review.rating,
            comment: review.comment,
            createdAt: review.createdAt,
            user: {
              name: review.userId?.fullName || 'Anonymous',
              profilePicture: review.userId?.profilePicture
            }
          }))
        };
      })
    );

    res.status(200).json({
      success: true,
      message: 'Featured providers fetched successfully',
      data: {
        providers: providersWithDetails,
        count: providersWithDetails.length,
        userLocation: {
          latitude: userLat,
          longitude: userLon
        }
      }
    });

  } catch (error) {
    console.error('Get featured providers error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching featured providers',
      error: error.message
    });
  }
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c; // Distance in meters
  return distance;
}

/**
 * Get all categories with provider count
 * GET /api/home/categories
 */
exports.getHomeCategories = async (req, res) => {
  try {
    const Category = require('../models/Category');

    const categories = await Category.find({ isActive: true }).sort({ name: 1 });

    // Count providers for each category
    const categoriesWithCount = await Promise.all(
      categories.map(async category => {
        const providerCount = await Provider.countDocuments({
          categories: category._id,
          verificationStatus: 'verified',
          isAvailable: true
        });

        return {
          categoryId: category._id,
          name: category.name,
          icon: category.icon,
          description: category.description,
          providerCount
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        categories: categoriesWithCount,
        count: categoriesWithCount.length
      }
    });

  } catch (error) {
    console.error('Get home categories error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching categories',
      error: error.message
    });
  }
};

/**
 * Get provider details for home page
 * GET /api/home/provider/:providerId
 */
exports.getProviderDetails = async (req, res) => {
  try {
    const { providerId } = req.params;
    const { latitude, longitude } = req.query;

    const provider = await Provider.findById(providerId)
      .populate({
        path: 'userId',
        select: 'fullName email phoneNumber profilePicture location'
      })
      .populate('categories', 'name icon');

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    if (provider.verificationStatus !== 'verified') {
      return res.status(403).json({
        success: false,
        message: 'Provider is not verified'
      });
    }

    const providerUser = provider.userId;

    // Calculate distance if user location provided
    let distance = null;
    let distanceKm = null;

    if (latitude && longitude && providerUser.location?.coordinates) {
      const [providerLon, providerLat] = providerUser.location.coordinates;
      distance = Math.round(calculateDistance(
        parseFloat(latitude),
        parseFloat(longitude),
        providerLat,
        providerLon
      ));
      distanceKm = (distance / 1000).toFixed(2);
    }

    // Get all services
    const services = await Service.find({
      providerId: provider._id,
      isActive: true
    })
      .populate('category', 'name icon')
      .sort({ createdAt: -1 });

    // Get all reviews
    const reviews = await Review.find({
      providerId: provider._id,
      isActive: true
    })
      .populate('userId', 'fullName profilePicture')
      .sort({ createdAt: -1 });

    // Get portfolio
    const Portfolio = require('../models/Portfolio');
    const portfolio = await Portfolio.find({
      providerId: provider._id,
      isActive: true
    }).sort({ displayOrder: 1, createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        provider: {
          providerId: provider._id,
          name: providerUser.fullName,
          email: providerUser.email,
          phoneNumber: providerUser.phoneNumber,
          profileImage: providerUser.profilePicture,
          address: providerUser.location?.address || 'Address not available',
          distance: distance,
          distanceKm: distanceKm,
          activityTime: provider.activityTime || 'Not specified',
          rating: provider.rating,
          totalReviews: provider.totalReviews,
          completedJobs: provider.completedJobs,
          isAvailable: provider.isAvailable,
          occupation: provider.occupation,
          categories: provider.categories
        },
        services: services.map(service => ({
          serviceId: service._id,
          serviceName: service.headline,
          serviceDetail: service.description,
          servicePhoto: service.servicePhoto,
          category: service.category,
          basePrice: service.basePrice,
          appointmentEnabled: service.appointmentEnabled,
          appointmentSlots: service.appointmentSlots,
          whyChooseUs: service.whyChooseUs,
          rating: service.rating,
          totalReviews: service.totalReviews,
          views: service.views,
          bookings: service.bookings
        })),
        reviews: reviews.map(review => ({
          reviewId: review._id,
          rating: review.rating,
          comment: review.comment,
          createdAt: review.createdAt,
          user: {
            name: review.userId?.fullName || 'Anonymous',
            profilePicture: review.userId?.profilePicture
          }
        })),
        portfolio: portfolio.map(item => ({
          portfolioId: item._id,
          title: item.title,
          beforeImage: item.beforeImage,
          afterImage: item.afterImage,
          about: item.about,
          serviceType: item.serviceType
        }))
      }
    });

  } catch (error) {
    console.error('Get provider details error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching provider details',
      error: error.message
    });
  }
};

/**
 * Get nearby providers grouped by category
 * GET /api/home/nearby-providers
 * Query params:
 *   - latitude: User's current latitude (required)
 *   - longitude: User's current longitude (required)
 *   - maxDistance: Maximum distance in meters (optional, default: 10000 = 10km)
 */
exports.getNearbyProvidersByCategory = async (req, res) => {
  try {
    const {
      latitude,
      longitude,
      maxDistance = 10000 // 10km default
    } = req.query;

    // Validate coordinates
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const userLat = parseFloat(latitude);
    const userLon = parseFloat(longitude);

    if (isNaN(userLat) || isNaN(userLon)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid latitude or longitude'
      });
    }

    // Get all active categories
    const Category = require('../models/Category');
    const categories = await Category.find({ isActive: true }).sort({ displayOrder: 1, name: 1 });

    // Get all verified and available providers
    const providers = await Provider.find({
      verificationStatus: 'verified',
      isAvailable: true
    })
      .populate({
        path: 'userId',
        select: 'fullName profilePicture location'
      })
      .populate('categories', 'name icon description');

    // Calculate distance for each provider and filter by maxDistance
    const providersWithDistance = providers
      .map(provider => {
        const providerUser = provider.userId;

        if (!providerUser || !providerUser.location ||
            !providerUser.location.coordinates ||
            providerUser.location.coordinates.length !== 2) {
          return null;
        }

        const [providerLon, providerLat] = providerUser.location.coordinates;

        // Calculate distance using Haversine formula (in meters)
        const distance = calculateDistance(
          userLat,
          userLon,
          providerLat,
          providerLon
        );

        if (distance > maxDistance) {
          return null; // Filter out providers beyond maxDistance
        }

        return {
          providerId: provider._id,
          name: providerUser.fullName,
          profileImage: providerUser.profilePicture,
          address: providerUser.location?.address || 'Address not available',
          distance: Math.round(distance), // Distance in meters
          distanceKm: (distance / 1000).toFixed(1), // Distance in km with 1 decimal
          activityTime: provider.activityTime || 'Not specified',
          rating: provider.rating,
          totalReviews: provider.totalReviews,
          completedJobs: provider.completedJobs,
          occupation: provider.occupation,
          categories: provider.categories // All categories this provider belongs to
        };
      })
      .filter(item => item !== null);

    // Group providers by category
    const categoriesWithProviders = categories.map(category => {
      // Find all providers that belong to this category
      const categoryProviders = providersWithDistance.filter(provider =>
        provider.categories && provider.categories.length > 0 &&
        provider.categories.some(cat => cat._id.toString() === category._id.toString())
      );

      // Sort providers by distance (closest first)
      categoryProviders.sort((a, b) => a.distance - b.distance);

      return {
        categoryId: category._id,
        categoryName: category.name,
        categoryIcon: category.icon,
        categoryDescription: category.description,
        providerCount: categoryProviders.length,
        providers: categoryProviders.map(provider => ({
          providerId: provider.providerId,
          name: provider.name,
          profileImage: provider.profileImage,
          address: provider.address,
          distance: provider.distance,
          distanceKm: provider.distanceKm,
          activityTime: provider.activityTime,
          rating: provider.rating,
          totalReviews: provider.totalReviews,
          completedJobs: provider.completedJobs,
          occupation: provider.occupation
        }))
      };
    }).filter(cat => cat.providerCount > 0); // Only include categories with providers

    // Find providers without any category assigned
    const providersWithoutCategory = providersWithDistance.filter(provider =>
      !provider.categories || provider.categories.length === 0
    );

    // If there are providers without categories, add them to an "Uncategorized" group
    if (providersWithoutCategory.length > 0) {
      providersWithoutCategory.sort((a, b) => a.distance - b.distance);

      categoriesWithProviders.push({
        categoryId: null,
        categoryName: 'Other Services',
        categoryIcon: null,
        categoryDescription: 'Providers without specific category',
        providerCount: providersWithoutCategory.length,
        providers: providersWithoutCategory.map(provider => ({
          providerId: provider.providerId,
          name: provider.name,
          profileImage: provider.profileImage,
          address: provider.address,
          distance: provider.distance,
          distanceKm: provider.distanceKm,
          activityTime: provider.activityTime,
          rating: provider.rating,
          totalReviews: provider.totalReviews,
          completedJobs: provider.completedJobs,
          occupation: provider.occupation
        }))
      });
    }

    res.status(200).json({
      success: true,
      message: 'Nearby providers fetched successfully',
      data: {
        categories: categoriesWithProviders,
        totalCategories: categoriesWithProviders.length,
        totalProviders: providersWithDistance.length,
        searchRadius: {
          meters: parseInt(maxDistance),
          kilometers: (parseInt(maxDistance) / 1000).toFixed(1)
        },
        userLocation: {
          latitude: userLat,
          longitude: userLon
        }
      }
    });

  } catch (error) {
    console.error('Get nearby providers by category error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching nearby providers',
      error: error.message
    });
  }
};

/**
 * Get all providers (for testing/debugging)
 * GET /api/home/all-providers
 */
exports.getAllProviders = async (req, res) => {
  try {
    const providers = await Provider.find({
      verificationStatus: 'verified'
    })
      .populate('userId', 'fullName email profilePicture location')
      .limit(50);

    const providerList = providers.map(provider => ({
      providerId: provider._id,
      name: provider.userId?.fullName,
      email: provider.userId?.email,
      isPaidForHomeScreen: provider.isPaidForHomeScreen,
      isAvailable: provider.isAvailable,
      rating: provider.rating,
      totalReviews: provider.totalReviews
    }));

    res.status(200).json({
      success: true,
      data: {
        providers: providerList,
        count: providerList.length
      }
    });

  } catch (error) {
    console.error('Get all providers error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching providers',
      error: error.message
    });
  }
};

// ===========================
// EVENT DISCOVERY FUNCTIONS
// ===========================

/**
 * Helper function to format event date for display
 */
function formatEventDate(dateTime) {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(dateTime).toLocaleDateString('en-US', options);
}

/**
 * Helper function to format event time range for display
 */
function formatEventTime(startDateTime, endDateTime) {
  const options = { hour: 'numeric', minute: '2-digit', hour12: true };
  const start = new Date(startDateTime).toLocaleTimeString('en-US', options);
  const end = new Date(endDateTime).toLocaleTimeString('en-US', options);
  return `${start} - ${end}`;
}

/**
 * Helper function to format events for display
 */
function formatEventsForDisplay(events) {
  return events.map(event => ({
    eventId: event._id,
    eventName: event.eventName,
    eventImage: event.eventImage,
    eventType: event.eventType,
    eventLocation: event.eventLocation,
    eventStartDateTime: event.eventStartDateTime,
    eventEndDateTime: event.eventEndDateTime,
    ticketPrice: event.ticketPrice,
    ticketsAvailable: event.ticketsAvailable,
    ticketsSold: event.ticketsSold,
    eventManagerName: event.eventManagerName,
    formattedDate: formatEventDate(event.eventStartDateTime),
    formattedTime: formatEventTime(event.eventStartDateTime, event.eventEndDateTime)
  }));
}

/**
 * Get popular events sorted by tickets sold
 * GET /api/home/popular-events
 * Query params:
 *   - limit: Number of events to return (optional, default: 20, max: 100)
 *   - eventType: Filter by event type (optional)
 */
exports.getPopularEvents = async (req, res) => {
  try {
    const { limit = 20, eventType } = req.query;

    const events = await Event.getAvailableEvents({
      eventType,
      limit: Math.min(parseInt(limit), 100),
      sortBy: 'ticketsSold'
    });

    // Filter out sold-out events (isSoldOut is a virtual property)
    const availableEvents = events.filter(event => !event.isSoldOut);

    res.status(200).json({
      success: true,
      data: {
        events: formatEventsForDisplay(availableEvents),
        count: availableEvents.length
      }
    });
  } catch (error) {
    console.error('Error fetching popular events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch events'
    });
  }
};

/**
 * Get event categories with counts
 * GET /api/home/event-categories
 */
exports.getEventCategories = async (req, res) => {
  try {
    const eventTypes = [
      'Concert/Music Show',
      'Cultural Program',
      'Seminar/Conference',
      'Sports Event',
      'Festival/Fair'
    ];

    const now = new Date();

    const categoriesWithCount = await Promise.all(
      eventTypes.map(async (type) => {
        const count = await Event.countDocuments({
          eventType: type,
          status: 'published',
          ticketSalesStartDate: { $lte: now },
          ticketSalesEndDate: { $gte: now },
          eventStartDateTime: { $gt: now }
        });

        return {
          eventType: type,
          displayName: type,
          availableEventCount: count
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        categories: categoriesWithCount.filter(cat => cat.availableEventCount > 0)
      }
    });
  } catch (error) {
    console.error('Error fetching event categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories'
    });
  }
};

/**
 * Get event details
 * GET /api/home/event/:eventId
 */
exports.getEventDetails = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const now = new Date();
    const isAvailableForPurchase =
      event.status === 'published' &&
      now >= event.ticketSalesStartDate &&
      now <= event.ticketSalesEndDate &&
      !event.isSoldOut &&
      event.eventStartDateTime > now;

    res.status(200).json({
      success: true,
      data: {
        event: {
          eventId: event._id,
          eventName: event.eventName,
          eventImage: event.eventImage,
          eventType: event.eventType,
          eventDescription: event.eventDescription,
          eventLocation: event.eventLocation,
          eventManagerName: event.eventManagerName,
          eventStartDateTime: event.eventStartDateTime,
          eventEndDateTime: event.eventEndDateTime,
          ticketPrice: event.ticketPrice,
          ticketsAvailable: event.ticketsAvailable,
          ticketsSold: event.ticketsSold,
          maximumNumberOfTickets: event.maximumNumberOfTickets,
          isAvailableForPurchase,
          isSoldOut: event.isSoldOut,
          formattedDate: formatEventDate(event.eventStartDateTime),
          formattedTime: formatEventTime(event.eventStartDateTime, event.eventEndDateTime)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching event details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch event details'
    });
  }
};
