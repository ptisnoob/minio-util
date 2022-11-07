/**
 * 封装基础的minio操作  crud
 * author pt
 */
const mime = require('mime')
const Minio = require('minio')
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

// 创建对象
function createClient(option) {
  this.connectFailed = isEmpty(option.endPoint) || isEmpty(option.accessKey) || isEmpty(option.secretKey)
  if (this.connectFailed) return false
  if (option.port) option.port = parseInt(option.port)
  option.useSSL = option.useSSL || false
  return new Minio.Client(option)
}

// 获取buckets
function getBuckets(client) {
  return new Promise((resolve) => {
    client.listBuckets((err, buckets) => {
      if (err) {
        // console.log('err', err)
        resolve(false)
      }
      resolve(buckets)
    })
  })
}

// 上传文件
function put(client, bucket, path, name, data, size, type) {
  return new Promise((resolve) => {
    type = type || mime.getType(name)
    client.putObject(bucket, path + name, data, size, { 'Content-Type': type }, () => {
      resolve()
    })
  })
}

// 下载文件 返回流
function get(client, bucket, path, name) {
  return new Promise((resolve) => {
    try {
      client.getObject(bucket, path + name, (err, dataStream) => {
        if (err) {
          resolve(false)
        }
        resolve(dataStream)
      })
    } catch (error) {
      resolve(false)
    }
  })
}

// 下载文件
function getBlob(client, bucket, path, name) {
  return new Promise((resolve) => {
    try {
      client.getObject(bucket, path + name, (err, dataStream) => {
        let size = 0
        const list = new Array()
        if (err) {
          resolve(false)
        }
        dataStream.on('data', (chunk) => {
          size += chunk.length
          list.push(chunk)
        })
        dataStream.on('end', () => {
          const length = list.length
          const u8arr = new Uint8Array(size)
          let u8arrindex = 0
          for (let i = 0; i < length; i++) {
            for (let j = 0; j < list[i].length; j++) {
              u8arr[u8arrindex] = list[i][j]
              u8arrindex++
            }
          }
          const blob = new Blob([u8arr])
          resolve(blob)
        })
      })
    } catch (error) {
      resolve(false)
    }
  })
}

// 删除文件
function del(client, bucket, path, name, ondel) {
  return new Promise((resolve) => {
    client.removeObject(bucket, path + name, (err) => {
      if (err) {
        console.log('删除文件失败。' + name, err)
        resolve(false)
      }
      if (ondel) ondel()
      resolve(true)
    })
  })
}

// 获取列表文件
function getList(client, bucket, path, recursion, onData) {
  return new Promise((resolve) => {
    const stream = client.listObjects(bucket, path || '', recursion)
    stream.on('data', (obj) => {
      if (onData && typeof onData === 'function') onData(obj)
    })
    stream.on('end', () => {
      resolve(true)
    })
  })
}

// 下载压缩包
async function downZIP(client, bucket, path, zipName, onGet) {
  let zip = new JSZip()
  const files = []
  await getList(client, bucket, path, true, async (data) => {
    const name = data.name.replace(path, '')
    files.push(name)
  })
  for (let index = 0; index < files.length; index++) {
    const i = files[index]
    if (onGet) onGet({ name: i, index: index, size: files.length })
    const blob = await getBlob(client, bucket, path, i)
    zip.file(i, blob)
  }
  const content = await zip.generateAsync({ type: 'blob' })
  saveAs(content, `${zipName}.zip`)
}

async function downZIP2(client, bucket, path, files, zipName, onGet) {
  let zip = new JSZip()
  for (let index = 0; index < files.length; index++) {
    const i = files[index]
    if (i.prefix) {
      await getList(client, bucket, path + i.prefix, true, async (data) => {
        const name = data.name.replace(path, '')
        const blob = await getBlob(client, bucket, path, name)
        zip.file(name, blob)
      })
    } else {
      const blob = await getBlob(client, bucket, path, i.name)
      zip.file(i.name, blob)
    }
    if (onGet) onGet({ name: i.name || i.prefix, index: index, size: files.length })
  }
  const content = await zip.generateAsync({ type: 'blob' })
  saveAs(content, `${zipName}.zip`)
}

function getSub(name, prefix = '.') {
  let split = name.split(prefix)
  return split[split.length - 1].toLocaleLowerCase()
}

function isEmpty(n) {
  return n === undefined || n === null || n === ''
}

export default {
  get: get,
  put: put,
  del: del,
  getList: getList,
  getSub: getSub,
  createClient: createClient,
  getBuckets: getBuckets,
  getBlob: getBlob,
  downZIP: downZIP,
  downZIP2: downZIP2
}
