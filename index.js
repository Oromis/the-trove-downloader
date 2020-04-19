const cheerio = require('cheerio')
const request = require('superagent')
const fs = require('fs')

async function timeout(ms) {
  return new Promise(resolve => {
    setTimeout(resolve)
  }, ms)
}

async function parseDirectory(url, localDir) {
  const res = await request.get(url)
  const doc = cheerio.load(res.text)
  const contentEntries = doc('table.listing-table tbody tr')
  for (let i = 0; i < contentEntries.length; ++i) {
    const tableRow = doc(contentEntries[i])
    const classes = tableRow.attr('class').split(' ').map(e => e.trim()).filter(e => e.length > 0)
    if (classes.includes('file')) {
      // File => download it
      const clickHandler = tableRow.attr('onclick')
      const match = clickHandler.match(/window.location.href='.\/(.*)'/)
      if (match) {
        const fileName = decodeURIComponent(match[1])
        const localFile = `${localDir}/${fileName}`
        const remoteFile = `${url}/${match[1]}`
        await downloadFile(remoteFile, localFile)
      } else {
        throw new Error(`Could not parse click handler ${clickHandler}`)
      }
    } else if (classes.includes('dir')) {
      // Directory => Browse recursively
      const clickHandler = tableRow.attr('onclick')
      const match = clickHandler.match(/window.location.href='(.*)'/)
      if (match) {
        const dir = match[1]
        if (!dir.startsWith('../')) {
          const childDir = `${localDir}/${decodeURIComponent(dir)}`
          fs.existsSync(childDir) || fs.mkdirSync(childDir)
          await parseDirectory(`${url}/${dir}`, childDir)
        }
      }
    }
  }
}

async function downloadFile(url, localFile) {
  if (!fs.existsSync(localFile)) {
    await timeout(1000)
    console.log(`Downloading file ${url} to ${localFile}`)
    const fileStream = fs.createWriteStream(localFile, { flags: 'wx', encoding: 'binary' })
    return request.get(url).pipe(fileStream)
  }
}

async function main() {
  if (process.argv.length < 3) {
    console.log(`Syntax: ${process.argv[0]} ${process.argv[1]} <trove-url>`)
    process.exit(1)
  }

  await parseDirectory(process.argv[2], process.argv.length >= 4 ? process.argv[3] : process.cwd())
}

main()
  .catch(err => console.error(err))
