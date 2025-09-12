const EnvVar = require("./mongodbenv");
const config = require("../config");

/**
 * Read environment variables from MongoDB.
 * Falls back to .env config if not found in DB.
 */
const readEnv = async () => {
  try {
    const envVars = await EnvVar.find({});
    const envVarObject = {};

    // Fill from DB first
    envVars.forEach((envVar) => {
      envVarObject[envVar.key] = envVar.value;
    });

    // Fill missing from .env
    Object.keys(config).forEach((key) => {
      if (envVarObject[key] === undefined && config[key] !== undefined) {
        envVarObject[key] = config[key];
      }
    });

    return envVarObject;
  } catch (err) {
    console.error("❌ Error retrieving environment variables:", err.message);
    throw err;
  }
};

/**
 * Update an environment variable in MongoDB.
 * Creates it if not exists.
 */
const updateEnv = async (key, newValue) => {
  try {
    const result = await EnvVar.findOneAndUpdate(
      { key },
      { value: newValue },
      { new: true, upsert: true }
    );

    if (result) {
      console.log(`✅ Updated ${key} to ${newValue}`);
    }
  } catch (err) {
    console.error("❌ Error updating environment variable:", err.message);
    throw err;
  }
};

module.exports = {
  readEnv,
  updateEnv,
};
