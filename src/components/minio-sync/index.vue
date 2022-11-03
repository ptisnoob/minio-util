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
      <el-button type="primary" size="medium" v-show="isStartSync" @click="stop">{{ !stopSync ? '暂停' : '继续' }}</el-button>
      <el-button type="warning" v-show="stopSync" @click="shutDown">结束</el-button>
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
const BaseClient = {
  name: '',
  bucketName: '',
  bucketOptions: [],
  client: null
}
const ConditionForm = {
  key: [],
  keyAnd: true,
  noKey: [],
  noKyeAnd: true,
  cover: true
}
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
      target: Object.assign({}, BaseClient),
      source: Object.assign({}, BaseClient),
      syncFiles: [],
      processText: '',
      processCount: '',
      isStartSync: false,
      successDialogVisible: false,
      errorList: [],
      moreSettingShow: false,
      conditionForm: Object.assign({}, ConditionForm),
      stopIndex: 0,
      stopSync: false
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
          n.client = this.$minio.createClient(c.option)
          this.$minio.getBuckets(n.client).then(res=>{
            n.bucketOptions = res || []
          })
        })
    },
    startSync() {
      this.$confirm('是否要开始同步？', '提示')
        .then(() => {
          if (this.source.bucketName === '' || this.source.bucketName === '') return this.$message.error('请先选择要同步的对象')
          this.isStartSync = true
          this.syncFiles = []
          this.$minio
            .getList(this.source.client, this.source.bucketName, '', true, async (obj) => {
              this.processText = `正在读取文件列表，${obj.name}`
              let match = true
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
              }
              if (match) this.syncFiles.push(obj)
            })
            .then(() => {
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
      for (let index = this.stopIndex; index < this.syncFiles.length; index++) {
        if (this.stopSync) {
          this.stopIndex = index
          return
        }
        const i = this.syncFiles[index]
        this.processCount = index + 1 + '/' + this.syncFiles.length
        this.processText = `正在同步${i.name} `
        const dataStrean = await this.$minio.get(this.source.client, this.source.bucketName, '', i.name)
        if (!dataStrean) {
          this.errorList.push(i)
          continue
        }
        await this.$minio.put(this.target.client, this.target.bucketName, '', i.name, dataStrean, i.size)
        this.$emit('sync-progress', this.processCount)
      }
      this.processText = '同步完成！'
      this.stopIndex = 0
      this.isStartSync = false
      this.successDialogVisible = true
      this.$emit('sync-success', this.target.name)
    },
    stop() {
      this.stopSync = !this.stopSync
      if (this.stopSync) this.processText = `已暂停`
      else this.syncFile()
    },
    shutDown() {
      this.stopIndex = 0
      this.isStartSync = false
      this.stopSync = false
      this.syncFiles = []
      this.target = Object.assign({}, BaseClient)
      this.source = Object.assign({}, BaseClient)
      this.conditionForm = Object.assign({}, ConditionForm)
      this.$emit('close')
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
      this.shutDown()
      // this.$emit('close')
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
