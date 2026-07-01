/* eslint-disable no-unused-vars */
const errorHandler = (err, req, res, next) => {
  console.error('[ERROR]', err);

  // Sequelize validation errors
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({
      success: false,
      message: err.errors?.[0]?.message || 'Validation error'
    });
  }

  const status = err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal server error'
  });
};

module.exports = errorHandler;
