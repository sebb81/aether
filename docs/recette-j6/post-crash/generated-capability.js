"use strict";
exports.run = function(input, api) {
  var result = {summary: "Plan de classement WAV", renames: [], data: null};
  var date = input.parameters.date;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return result;
  var year = Number(date.slice(0, 4));
  var month = Number(date.slice(5, 7));
  var day = Number(date.slice(8, 10));
  var leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  var days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1]) return result;
  var files = input.files;
  var occupiedFiles = Object.create(null);
  var occupiedDirectories = Object.create(null);
  var planned = Object.create(null);
  var i;
  for (i = 0; i < files.length; i++) {
    var key = files[i].path.toLowerCase();
    occupiedFiles[key] = (occupiedFiles[key] || 0) + 1;
    var parts = key.split("/");
    var prefix = "";
    for (var j = 0; j < parts.length - 1; j++) {
      prefix = prefix ? prefix + "/" + parts[j] : parts[j];
      occupiedDirectories[prefix] = true;
    }
  }
  if (occupiedFiles[date.toLowerCase()]) return result;
  for (i = 0; i < files.length; i++) {
    var path = files[i].path;
    var sourceKey = path.toLowerCase();
    if (path.indexOf("/") !== -1 || !/\.wav$/i.test(path)) continue;
    if (occupiedFiles[sourceKey] !== 1 || occupiedDirectories[sourceKey]) continue;
    var destination = date + "/" + path;
    var destinationKey = destination.toLowerCase();
    if (occupiedFiles[destinationKey] || occupiedDirectories[destinationKey] || planned[destinationKey]) continue;
    planned[destinationKey] = true;
    result.renames.push({from: path, to: destination});
  }
  return result;
};