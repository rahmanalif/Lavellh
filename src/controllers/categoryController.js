const Category = require('../models/Category');

/**
 * Create Category (Admin only)
 * POST /api/admin/categories
 */
exports.createCategory = async (req, res) => {
  try {
    const { name, description, icon, parentCategory, displayOrder } = req.body;

    // Validate input
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required'
      });
    }

    // Check if category with same name already exists
    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category with this name already exists'
      });
    }

    // If parentCategory is provided, verify it exists
    if (parentCategory) {
      const parentExists = await Category.findById(parentCategory);
      if (!parentExists) {
        return res.status(404).json({
          success: false,
          message: 'Parent category not found'
        });
      }
    }

    // Create new category
    const category = new Category({
      name,
      description,
      icon,
      parentCategory: parentCategory || null,
      displayOrder: displayOrder || 0,
      createdBy: req.admin._id
    });

    await category.save();

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: {
        category
      }
    });

  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while creating category',
      error: error.message
    });
  }
};

/**
 * Get All Categories (Admin)
 * GET /api/admin/categories
 */
exports.getAllCategoriesAdmin = async (req, res) => {
  try {
    const { includeInactive, parentOnly } = req.query;

    const query = {};

    // Filter by active status
    if (!includeInactive || includeInactive === 'false') {
      query.isActive = true;
    }

    // Filter to show only parent categories (no subcategories)
    if (parentOnly === 'true') {
      query.parentCategory = null;
    }

    const categories = await Category.find(query)
      .populate('parentCategory', 'name slug')
      .populate('createdBy', 'fullName email')
      .populate('subcategories')
      .sort({ displayOrder: 1, name: 1 });

    res.status(200).json({
      success: true,
      data: {
        categories,
        total: categories.length
      }
    });

  } catch (error) {
    console.error('Get all categories (admin) error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching categories',
      error: error.message
    });
  }
};

/**
 * Get Single Category (Admin)
 * GET /api/admin/categories/:id
 */
exports.getCategoryByIdAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id)
      .populate('parentCategory', 'name slug')
      .populate('createdBy', 'fullName email')
      .populate('subcategories');

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        category
      }
    });

  } catch (error) {
    console.error('Get category by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching category',
      error: error.message
    });
  }
};

/**
 * Update Category (Admin only)
 * PUT /api/admin/categories/:id
 */
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, icon, parentCategory, displayOrder, isActive } = req.body;

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check if new name conflicts with existing category
    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: id }
      });

      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: 'Category with this name already exists'
        });
      }
    }

    // Prevent setting itself as parent
    if (parentCategory && parentCategory === id) {
      return res.status(400).json({
        success: false,
        message: 'Category cannot be its own parent'
      });
    }

    // Verify parent category exists
    if (parentCategory) {
      const parentExists = await Category.findById(parentCategory);
      if (!parentExists) {
        return res.status(404).json({
          success: false,
          message: 'Parent category not found'
        });
      }
    }

    // Update fields
    if (name !== undefined) category.name = name;
    if (description !== undefined) category.description = description;
    if (icon !== undefined) category.icon = icon;
    if (parentCategory !== undefined) category.parentCategory = parentCategory || null;
    if (displayOrder !== undefined) category.displayOrder = displayOrder;
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();

    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: {
        category
      }
    });

  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating category',
      error: error.message
    });
  }
};

/**
 * Delete Category (Admin only)
 * DELETE /api/admin/categories/:id
 */
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check if category has subcategories
    const subcategories = await Category.countDocuments({ parentCategory: id });
    if (subcategories > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category with subcategories. Please delete or reassign subcategories first.'
      });
    }

    // TODO: Check if any providers are using this category
    // Uncomment when Provider model is updated
    // const Provider = require('../models/Provider');
    // const providersCount = await Provider.countDocuments({ categories: id });
    // if (providersCount > 0) {
    //   return res.status(400).json({
    //     success: false,
    //     message: `Cannot delete category. ${providersCount} provider(s) are using this category.`
    //   });
    // }

    await category.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
    });

  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while deleting category',
      error: error.message
    });
  }
};

/**
 * Toggle Category Active Status (Admin only)
 * PUT /api/admin/categories/:id/toggle-status
 */
exports.toggleCategoryStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    category.isActive = !category.isActive;
    await category.save();

    res.status(200).json({
      success: true,
      message: `Category ${category.isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        category
      }
    });

  } catch (error) {
    console.error('Toggle category status error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating category status',
      error: error.message
    });
  }
};

// ============ PUBLIC ENDPOINTS (For Users) ============

/**
 * Get All Active Categories (Public)
 * GET /api/categories
 */
exports.getAllCategories = async (req, res) => {
  try {
    const { parentOnly } = req.query;

    const query = { isActive: true };

    // Filter to show only parent categories
    if (parentOnly === 'true') {
      query.parentCategory = null;
    }

    const categories = await Category.find(query)
      .populate('parentCategory', 'name slug')
      .populate({
        path: 'subcategories',
        match: { isActive: true },
        select: 'name slug description icon displayOrder'
      })
      .select('-createdBy -updatedAt')
      .sort({ displayOrder: 1, name: 1 });

    res.status(200).json({
      success: true,
      data: {
        categories,
        total: categories.length
      }
    });

  } catch (error) {
    console.error('Get all categories error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching categories',
      error: error.message
    });
  }
};

/**
 * Get Category by Slug (Public)
 * GET /api/categories/:slug
 */
exports.getCategoryBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const category = await Category.findOne({ slug, isActive: true })
      .populate('parentCategory', 'name slug')
      .populate({
        path: 'subcategories',
        match: { isActive: true },
        select: 'name slug description icon displayOrder'
      })
      .select('-createdBy -updatedAt');

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        category
      }
    });

  } catch (error) {
    console.error('Get category by slug error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching category',
      error: error.message
    });
  }
};
