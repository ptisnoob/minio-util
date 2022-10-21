<template>
  <div class="mini-sync" :style="moreSettingShow ? 'height:300px;' : ''">
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
    <!-- <el-collapse-transition> -->
    <div class="sync-condition-form" v-show="moreSettingShow">
      <condition-form :condition-form="conditionForm" @back="moreSettingShow = false"></condition-form>
    </div>
    <!-- </el-collapse-transition> -->
    <div class="sync-progress-box" v-show="isStartSync">
      <div class="process-text">{{ processCount }}</div>
      {{ processText }}
    </div>
    <div class="button-box">
      <el-button type="primary" @click="moreSettingShow = true" :loading="isStartSync">高级设置</el-button>
      <el-button type="primary" @click="startSync" :loading="isStartSync">{{ isStartSync ? '正在同步' : '开始同步' }}</el-button>
    </div>
    <el-dialog :visible.sync="successDialogVisible" append-to-body :close-on-click-modal="false" :close-on-press-escape="false">
      <el-result icon="success" title="同步完成" :subTitle="`同步完成文件${syncFiles.length}条,失败${errorList.length}条`">
        <template slot="extra">
          <div class="error-list" v-if="errorList.length > 0">
            <span v-for="(n, index) in errorList" :key="index">{{ n.name }}</span>
          </div>
          <el-button type="primary" size="medium" @click="closeSuccessDialogVisible">关闭</el-button>
          <el-button type="primary" size="medium" @click="successDialogVisible = false">继续同步</el-button>
          <el-button v-if="errorList.length > 0" type="primary" size="medium" @click="syncErrorList">重新同步失败文件</el-button>
        </template>
      </el-result>
    </el-dialog>
  </div>
</template>
<script>
const Minio = require('minio')
const mime = require('mime')
import conditionForm from './components/condition'
export default {
  name: 'minioSync',
  components: { conditionForm },
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
      processCount: '',
      isStartSync: false,
      successDialogVisible: false,
      errorList: [],
      moreSettingShow: false,
      conditionForm: {
        key: [],
        keyAnd: true,
        noKey: [],
        noKyeAnd: true,
        cover: true
      }
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
      this.$confirm('是否要开始同步？', '提示')
        .then(() => {
          if (this.source.bucketName === '' || this.source.bucketName === '') return this.$message.error('请先选择要同步的对象')
          this.isStartSync = true
          this.syncFiles = []
          const stream = this.source.client.listObjects(this.source.bucketName, '', true)
          stream.on('data', async (obj) => {
            this.processText = `正在读取文件列表，${obj.name}`
            let match = true
            // const path = obj.name.split('/')
            const fileName = obj.name // path[path.length - 1]
            if (this.conditionForm.key.length > 0) {
              if (this.conditionForm.keyAnd) {
                match = !this.conditionForm.key.some((i) => fileName.indexOf(i) === -1) //与 只要有一个不符合
              } else {
                match = this.conditionForm.key.some((i) => fileName.indexOf(i) > -1) // 或 只要有一个符合
              }
            }

            if (match && this.conditionForm.noKey.length > 0) {
              match = !this.conditionForm.noKey.some((i) => fileName.indexOf(i) > -1) // 或 只要有一个符合
            }

            if (match && !this.conditionForm.cover) {
              match = !(await this.isExists(obj.name))
              console.log('isExists', match)
            }
            if (match) this.syncFiles.push(obj)
          })
          stream.on('end', async () => {
            this.syncFile()
          })
        })
        .catch(() => {})
    },
    syncErrorList() {
      this.isStartSync = true
      this.successDialogVisible = false
      this.syncFiles = this.errorList
      this.syncFile()
    },
    async syncFile() {
      console.log('列表读取完成')
      this.errorList = []
      this.processText = '列表读取完成'
      for (let index = 0; index < this.syncFiles.length; index++) {
        const i = this.syncFiles[index]
        this.processCount = index + 1 + '/' + this.syncFiles.length
        this.processText = `正在同步${i.name} `
        const dataStrean = await this.getObject(i)
        if (!dataStrean) {
          this.errorList.push(i)
          continue
        }
        await this.putObject(i, dataStrean)
      }
      this.processText = '同步完成！'
      this.isStartSync = false
      this.successDialogVisible = true
      this.$emit('sync-success', this.target.name)
    },
    getObject(i) {
      return new Promise((resolve) => {
        try {
          this.source.client.getObject(this.source.bucketName, i.name, function (err, dataStream) {
            if (err) {
              console.log('error getting object')
              resolve(false)
            }
            resolve(dataStream)
          })
        } catch (error) {
          console.log('error catch')
          resolve(false)
        }
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
    isExists(i) {
      return new Promise((resolve) => {
        this.target.client.statObject(this.target.bucketName, i, (err) => {
          if (err) resolve(false)
          resolve(true)
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
    },
    closeSuccessDialogVisible() {
      this.successDialogVisible = false
      this.$emit('close')
    }
  }
}
</script>
<style scoped>
.mini-sync {
  position: relative;
  /* height: 350px; */
  /* transition: all 0.3s ease-in-out; */
}
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

.error-list {
  max-height: 300px;
  overflow-y: auto;
}
.error-list > span {
  color: red;
  margin: 10px;
  display: inline-block;
}
.sync-condition-form {
  position: absolute;
  width: 100%;
  left: 0;
  top: 0;
  height: 100%;
  background: #fff;
}
</style>
