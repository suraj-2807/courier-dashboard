const generateTracking = () => {
  const random = Math.floor(100000000 + Math.random() * 900000000)
  return String(random)
}

export default generateTracking