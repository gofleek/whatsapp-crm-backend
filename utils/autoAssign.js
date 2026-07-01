const { User } = require('../models');

// In-memory pointer for round-robin. Fine for a single Railway instance.
// (If you ever scale to multiple instances, move this pointer into the DB/Redis.)
let lastAssignedIndex = -1;

/**
 * Picks the next active salesman in round-robin order.
 * Returns the User instance, or null if no active salesmen exist.
 */
async function getNextSalesman() {
  const salesmen = await User.findAll({
    where: { role: 'salesman', is_active: true },
    order: [['id', 'ASC']]
  });

  if (salesmen.length === 0) return null;

  lastAssignedIndex = (lastAssignedIndex + 1) % salesmen.length;
  return salesmen[lastAssignedIndex];
}

module.exports = { getNextSalesman };
