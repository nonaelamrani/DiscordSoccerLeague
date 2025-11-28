/**
 * Converts a date (YYYY-MM-DD) and time (HH:MM) to a UNIX timestamp
 * Assumes UTC timezone
 */
function dateTimeToUnix(date, time) {
  const [year, month, day] = date.split('-');
  const [hours, minutes] = time.split(':');
  
  const dateObj = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
  return Math.floor(dateObj.getTime() / 1000);
}

/**
 * Converts a UNIX timestamp to a human-readable date and time string
 * Discord will automatically convert this to the user's local timezone
 */
function unixToTimestamp(unixTime) {
  return `<t:${unixTime}:f>`;
}

/**
 * Converts a UNIX timestamp to date (YYYY-MM-DD) format for display
 * Used for grouping fixtures by date
 */
function unixToDateString(unixTime) {
  const dateObj = new Date(unixTime * 1000);
  const year = dateObj.getUTCFullYear();
  const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Converts a UNIX timestamp to time (HH:MM) format
 */
function unixToTimeString(unixTime) {
  const dateObj = new Date(unixTime * 1000);
  const hours = String(dateObj.getUTCHours()).padStart(2, '0');
  const minutes = String(dateObj.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

module.exports = {
  dateTimeToUnix,
  unixToTimestamp,
  unixToDateString,
  unixToTimeString
};
