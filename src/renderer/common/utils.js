

function randomChoice(items, numToChoose) {
  // Initialize an array to store the chosen items

  if (items.length < numToChoose) {
    return items
  }

  const chosenItems = [];

  // Fill the reservoir with the first numToChoose items
  for (let i = 0; i < numToChoose; i++) {
    chosenItems[i] = items[i];
  }

  // Replace items in the reservoir with gradually decreasing probability
  for (let i = numToChoose; i < items.length; i++) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    if (randomIndex < numToChoose) {
      chosenItems[randomIndex] = items[i];
    }
  }

  // Return the chosen items array
  return chosenItems;
}

function J(obj) {
  return JSON.stringify(obj)
}

export { randomChoice, J }