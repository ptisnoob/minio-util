/**
 * 封装基础的minio操作  crud
 * author pt
 */
const mime = require('mime')
const Minio = require('minio')

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

// 下载文件
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
  getBuckets: getBuckets
}
