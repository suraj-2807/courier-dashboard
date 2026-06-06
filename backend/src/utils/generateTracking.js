const generateTracking = () => {
  const random =
    Math.floor(
      100000 + Math.random() * 900000
    )

  return `TRK${random}`
}

export default generateTracking