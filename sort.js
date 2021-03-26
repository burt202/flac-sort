const fs = require("fs")
const Metaflac = require("metaflac-js")
const R = require("ramda")

const directoryPath = "/media/aaron/My Files/Music"

const IGNORE_LIST = []

const AUTO_THRESHOLD = 5

const allFiles = fs.readdirSync(directoryPath)

const files = allFiles.filter((path) => {
  const artist = path.split(" - ")[0]
  const parts = path.split(".")
  const extension = parts[parts.length -1]

  if (extension !== "flac") {
    return false
  }

  if (IGNORE_LIST.includes(artist)) {
    return false
  }

  return fs.statSync(directoryPath + "/" + path).isDirectory() === false
})

if (files.length === 0) {
  console.log("No files in directory")
  process.exit()
}

const firstFile = files[0]
const firstFileArtist = firstFile.split(" - ")[0]

console.log(`Artist: ${firstFileArtist}`)

const filesForArtist = files.filter((path) => {
  const artist = path.split(" - ")[0]
  return artist === firstFileArtist
})

console.log(`Files for artist: ${filesForArtist.length}`)

if (filesForArtist.length === 1) {
  const artistPath = directoryPath + "/" + firstFileArtist

  if (fs.existsSync(artistPath)) {
    fs.renameSync(directoryPath + "/" + filesForArtist[0], directoryPath + "/" + firstFileArtist + "/" + filesForArtist[0])
    console.log(`Moved '${filesForArtist[0]}' to ${artistPath}`)

    process.exit()
  }

  fs.renameSync(directoryPath + "/" + filesForArtist[0], directoryPath + "/Misc/" + filesForArtist[0])
  console.log(`Moved '${filesForArtist[0]}' to Misc`)

  process.exit()
}

if (filesForArtist.length <= AUTO_THRESHOLD) {
  console.log("Files for artist below auto threshold")
  process.exit()
}

function getTagValue(flac, tagName) {
  const value = flac.getTag(tagName)
  return value.split("=")[1]
}

const withTags = filesForArtist.map((path) => {
  const flac = new Metaflac(directoryPath + "/" + path)

  return {
    path,
    title: getTagValue(flac, "title") || getTagValue(flac, "Title") || getTagValue(flac, "TITLE"),
    album: getTagValue(flac, "album") || getTagValue(flac, "Album") || getTagValue(flac, "ALBUM"),
    trackNo: getTagValue(flac, "TRACKNUMBER") || getTagValue(flac, "tracknumber"),
  }
})

const groupedByAlbum = R.groupBy(R.prop("album"), withTags)

const completeAlbums = Object.keys(groupedByAlbum).filter((key) => {
  const files = groupedByAlbum[key]
  const highestTrackNo = R.pipe(
    R.pluck("trackNo"),
    R.map((num) => parseInt(num, 10)),
    (trackNos) => Math.max(...trackNos)
  )(files)

  return files.length === highestTrackNo
})

if (completeAlbums.length === 0) {
  console.log("No complete albums for artist")
  process.exit()
}

const artistPath = directoryPath + "/" + firstFileArtist

if (!fs.existsSync(artistPath)) {
  fs.mkdirSync(artistPath)
}

completeAlbums.forEach((albumName) => {
  const albumPath = artistPath + "/" + albumName.replace(/\//g, ",")
  fs.mkdirSync(albumPath)

  const album = groupedByAlbum[albumName]

  album.forEach((file) => {
    const title = file.title.replace(/\//g, ",")
    const newPath = `${file.trackNo} - ${title}.flac`
    fs.renameSync(directoryPath + "/" + file.path, albumPath + "/" + newPath)
    console.log(`Moved '${file.path}' to ${albumPath}`)
  })
})
