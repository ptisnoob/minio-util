<template>
  <div class="mini-sync">
    <div class="sync-content">
      <div class="source-form">
        <div class="form-item">
          <div class="form-item-label">源地址：</div>
          <el-select v-model="source.name" placeholder="请选择源对象" @change="changeSource" :disabled="isStartSync">
            <el-option v-for="item in clients" :key="item.name" :label="item.title" :value="item.name"> </el-option>
          </el-select>
        </div>
        <div class="form-item">
          <div class="form-item-label">源bucket:</div>
          <el-select v-model="source.bucketName" placeholder="请选择源Bucket" :disabled="isStartSync">
            <el-option v-for="item in source.bucketOptions" :key="item.name" :label="item.name" :value="item.name"> </el-option>
          </el-select>
        </div>
      </div>
      <i class="el-icon-refresh" @click="swap"></i>
      <div class="target-form">
        <div class="form-item">
          <div class="form-item-label">目标地址：</div>
          <el-select v-model="target.name" placeholder="请选择目标对象" @change="changeTarget" :disabled="isStartSync">
            <el-option v-for="item in clients" :key="item.name" :label="item.title" :value="item.name"> </el-option>
          </el-select>
        </div>
        <div class="form-item">
          <div class="form-item-label">目标bucket:</div>
          <el-select v-model="target.bucketName" placeholder="请选择目标Bucket" :disabled="isStartSync">
            <el-option v-for="item in target.bucketOptions" :key="item.name" :label="item.name" :value="item.name"> </el-option>
          </el-select>
        </div>
      </div>
    </div>
    <div class="sync-progress-box" v-show="isStartSync">
      {{ processText }}
    </div>
    <div class="button-box">
      <el-button type="primary" @click="startSync" :loading="isStartSync">{{ isStartSync ? '正在同步' : '开始同步' }}</el-button>
    </div>
  </div>
</template>
<script>
const Minio = require('minio')
const mime = require('mime')
export default {
  name: 'minioSync',
  props: {
    clients: {
      type: Array,
      default: () => {
        return []
      }
    }
  },
  data() {
    return {
      target: {
        name: '',
        bucketName: '',
        bucketOptions: [],
        client: null
      },
      source: {
        name: '',
        bucketName: '',
        bucketOptions: [],
        client: null
      },
      syncFiles: [],
      processText: '',
      isStartSync: false
    }
  },
  methods: {
    changeSource() {
      this.getBucketList(this.source)
    },
    changeTarget() {
      this.getBucketList(this.target)
    },
    getBucketList(n) {
      n.bucketName = ''
      this.clients
        .filter((i) => i.name === n.name)
        .forEach((c) => {
          let { endPoint, port, useSSL, accessKey, secretKey } = c.option
          if (port) port = parseInt(port)
          n.client = new Minio.Client({
            endPoint: endPoint,
            port: port,
            useSSL: useSSL || false,
            accessKey: accessKey,
            secretKey: secretKey
          })
          n.client.listBuckets((err, buckets) => {
            if (err) return console.log(err)
            n.bucketOptions = buckets
          })
        })
    },
    startSync() {
      this.$confirm('是否要继续同步？', '提示')
        .then(() => {
          console.log('点击了确定')
          if (this.source.bucketName === '' || this.source.bucketName === '') return this.$message.error('请先选择要同步的对象')
          this.isStartSync = true
          const stream = this.source.client.listObjects(this.source.bucketName, '', true)
          stream.on('data', (obj) => {
            this.processText = `正在读取文件列表，${obj.name}`
            this.syncFiles.push(obj)
          })
          stream.on('end', async () => {
            console.log('列表读取完成')
            this.processText = '列表读取完成'
            for (let index = 0; index < this.syncFiles.length; index++) {
              const i = this.syncFiles[index]
              console.log('当前:' + (index + 1) + '/' + this.syncFiles.length)
              console.log('开始读取' + i.name)
              this.processText = `正在同步${i.name}` + (index + 1) + '/' + this.syncFiles.length
              const dataStrean = await this.getObject(i)
              await this.putObject(i, dataStrean)
            }
            this.processText = '同步完成！'
            this.isStartSync = false
            this.$notify({
              title: '同步成功',
              message: `数据同步完成.${this.source.client.host}/${this.source.bucketName}  -> ${this.target.client.host}/${this.target.bucketName}`,
              type: 'success'
            })
            this.$emit('sync-success', this.target.name)
          })
        })
        .catch(() => {})
    },
    getObject(i) {
      return new Promise((resolve) => {
        this.source.client.getObject(this.source.bucketName, i.name, function (err, dataStream) {
          resolve(dataStream)
        })
      })
    },
    putObject(i, dataStream) {
      return new Promise((resolve) => {
        let type = mime.getType(i.name)
        this.target.client.putObject(this.target.bucketName, i.name, dataStream, i.size, { 'Content-Type': type }, () => {
          console.log('上传成功' + i.name + ' Type= ' + type + ' 大小：' + i.size)
          resolve()
        })
      })
    },
    deepClone(obj) {
      if (typeof obj !== 'object') return
      let newObj = obj instanceof Array ? [] : {}
      for (let key in obj) {
        if (typeof obj[key] === 'object') {
          newObj[key] = this.deepClone(obj[key])
        } else {
          newObj[key] = obj[key]
        }
      }
      return newObj
    },
    swap() {
      const cloneSource = this.deepClone(this.source)
      const cloneTarget = this.deepClone(this.target)
      this.source = cloneTarget
      this.target = cloneSource
    }
  }
}
</script>
<style scoped>
.sync-content {
  display: flex;
  justify-content: space-evenly;
  align-items: center;
}
.sync-content > .el-icon-refresh {
  font-size: 28px;
  cursor: pointer;
  color: #0f4b37;
}
.sync-progress-box,
.button-box {
  text-align: center;
  padding: 20px 0 0;
}
.form-item {
  margin: 10px 0;
}
</style>
