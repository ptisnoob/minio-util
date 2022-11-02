<template>
  <div
    class="client-box"
    v-loading="pageLoading"
    :element-loading-text="loadingText"
    element-loading-spinner="el-icon-loading"
    element-loading-background="rgba(0, 0, 0, 0.8)"
  >
    <div class="bucket-box">
      <div
        :class="['bucket-item', { 'active-bucket': activeBucket === n.name }]"
        v-for="(n, index) in buckets"
        :key="index"
        @click="selBucket(n.name)"
        @click.right="rightClickBucket = n"
        @contextmenu.prevent="onContextmenu"
      >
        <span class="bucket-item-title"> {{ n.name }}</span>
      </div>
      <div class="bucket-item" @click="createBucketDialogVisible = true">
        <span class="bucket-item-title color-primary"> 新增Bucket</span>
      </div>
    </div>
    <div class="tool-box">
      <el-form inline :model="searchForm" label-width="auto">
        <el-form-item label="关键字">
          <el-input v-model="searchForm.key" placeholder="请输入关键字进行搜索" @input="search"></el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="resetSearch">重置搜索</el-button>
          <el-button type="primary" @click="refreshFiles">刷新数据</el-button>
          <el-button type="primary" @click="showSelect = !showSelect">{{ showSelect ? '完成选择' : '开启选择' }}</el-button>
          <el-button type="primary" v-show="showSelect" plain @click="selectList = bucketFiles">全选</el-button>
          <el-button type="primary" plain @click="paste">粘贴</el-button>
          <el-button type="primary" plain @click="createMenu">新增目录</el-button>
        </el-form-item>
        <el-form-item style="float: right" v-show="currentPath !== ''">
          <el-button type="primary" @click="back">返回</el-button>
        </el-form-item>
        <el-form-item class="tj-data">
          总数: <span>{{ bucketFiles.length }}</span> ,文件数量:<span>{{ bucketFiles.filter((i) => i.name !== undefined).length }}</span>
          ,目录数量:<span>{{ bucketFiles.filter((i) => i.name === undefined).length }}</span>
        </el-form-item>
      </el-form>
    </div>
    <div class="current-path">
      当前路径：<span> {{ activeBucket }}</span> / <span>{{ currentPath }}</span>
    </div>
    <div :class="['file-box', { 'drop-file-ing': dropFileIng, 'show-select': showSelect }]" :id="randomId">
      <el-empty v-if="bucketFiles.length === 0">
        <el-button type="primary">上传文件</el-button>
      </el-empty>
      <file-item
        v-else
        :class="{ 'is-select': selectList.indexOf(n) > -1 }"
        v-for="(n, index) in bucketFiles"
        :key="index"
        :n="n"
        :imgPreviewList="imgPreviewList"
        @selItem="selItem(n, index)"
        @delMenu="removeMenu(n.prefix)"
        @downLoadMenu="downMenu(n.prefix)"
        @showMenu="showMenu(n.prefix)"
        @delFile="removeFile(currentPath + n.name)"
        @downLoadFile="downFile(n.name)"
        @rename="rename"
      ></file-item>
    </div>

    <el-dialog title="新建Bucket" :visible.sync="createBucketDialogVisible">
      <el-form :model="createForm" label-width="auto">
        <el-form-item label="Bucket名称">
          <el-input v-model="createForm.name" placeholder="请填写Bucket名称,不能包含中文！"></el-input>
        </el-form-item>
        <el-form-item label="权限">
          <el-select v-model="createForm.policy" placeholder="请选择Bucket权限">
            <el-option :label="n.label" :value="n.value" v-for="n in bucketPolicy" :key="n.label"></el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <div slot="footer">
        <el-button @click="createBucketDialogVisible = false">取 消</el-button>
        <el-button type="primary" @click="createBucket">确 定</el-button>
      </div>
    </el-dialog>

    <!--  多选操作栏 -->
    <div :class="['multiple-choice-box', { show: selectOver }]">
      <div class="content">
        <div class="select-tips">已选择{{ selectList.length }}项，可以做如下操作</div>
        <el-button-group>
          <el-button type="danger" @click="closeSelectOverDialog('del')">删除</el-button>
          <el-button type="primary" @click="closeSelectOverDialog('download')">下载</el-button>
          <el-button type="primary" @click="closeSelectOverDialog('copy')">复制</el-button>
        </el-button-group>
        <i class="el-icon-close" @click="closeSelectOverDialog"></i>
      </div>
    </div>
  </div>
</template>
<script>
import fileItem from './components/fileItem'
const Minio = require('minio')
const mime = require('mime')
const imgPrefix = ['png', 'jpg', 'gif', 'jpeg', 'jfif']
const bucketPolicy = [
  {
    label: '私有的',
    value: 'private'
  },
  {
    label: '公开的',
    value: 'public'
  }
]
export default {
  name: 'minioClient',
  components: { fileItem },
  props: {
    option: {
      type: Object,
      required: true
    }
  },
  watch: {
    showSelect() {
      if (!this.showSelect) {
        console.log('选择完成')
        if (this.selectList.length > 0) this.selectOver = true
      }
    }
  },
  data() {
    return {
      searchForm: {
        key: ''
      },
      randomId: new Date().getTime() + Math.random().toString(36).substr(2),
      pageLoading: false,
      loadingText: '正在加载中',
      connectFailed: true,
      minioClient: null,
      buckets: [],
      activeBucket: '',
      bucketFiles: [],
      currentPath: '',
      imgPreviewList: [],
      rightClickBucket: null,
      createBucketDialogVisible: false,
      createForm: {
        name: '',
        policy: 'public'
      },
      bucketPolicy,
      files: [],
      dropFileIng: false,
      showSelect: false,
      selectList: [],
      shiftEnter: false,
      selectOver: false
    }
  },
  methods: {
    init() {
      if (!this.option) return
      let { endPoint, port, useSSL, accessKey, secretKey } = this.option
      // console.log('endPoint, port, useSSL, accessKey, secretKey', endPoint, port, useSSL, accessKey, secretKey)
      this.connectFailed = this.isEmpty(endPoint) || this.isEmpty(accessKey) || this.isEmpty(secretKey)
      if (this.connectFailed) return
      if (port) port = parseInt(port)
      this.minioClient = new Minio.Client({
        endPoint: endPoint,
        port: port,
        useSSL: useSSL || false,
        accessKey: accessKey,
        secretKey: secretKey
      })
      this.getBucketList()
    },
    selBucket(name) {
      if (this.activeBucket === name) return
      this.currentPath = ''
      this.activeBucket = name
      this.getFileList(name)
      // console.log('name', typeof this.getPolicyCallBack)
    },
    showMenu(path) {
      this.currentPath += path
      this.getFileList(this.activeBucket, this.currentPath)
    },
    getBucketList() {
      this.minioClient.listBuckets((err, buckets) => {
        if (err) return console.log(err)
        this.buckets = buckets
        if (this.buckets.length > 0) this.selBucket(this.buckets[0].name)
      })
    },
    removeBucket() {
      this.$confirm('是否要删除Bucket:' + this.rightClickBucket.name, '提示', { type: 'warning' }).then(() => {
        this.minioClient.removeBucket(this.rightClickBucket.name, (err) => {
          if (err) return this.$message.error('删除bucket失败,原因:' + err.message)
          this.$message.success('删除bucket成功')
          this.buckets.splice(this.buckets.indexOf(this.rightClickBucket), 1)
          this.selBucket(this.buckets[0].name)
        })
      })
    },
    getFileList(name, path) {
      this.pageLoading = true
      this.files = []
      this.imgPreviewList = []
      const stream = this.minioClient.listObjects(name, path || '')
      stream.on('data', (obj) => {
        if (obj.name) {
          let name = obj.name.split('/')
          let split = obj.name.split('.')
          const sub = split[split.length - 1].toLocaleLowerCase()
          if (imgPrefix.indexOf(sub) > -1) {
            let imgPath = this.option.endPoint + ':' + this.option.port + '/' + this.activeBucket + '/'
            if (!this.option.endPoint.startsWith('http')) {
              imgPath = (this.option.useSSL ? 'https://' : 'http://') + imgPath
            }
            obj.imgPath = imgPath + obj.name
            this.imgPreviewList.push(obj.imgPath) // 预览列表
          }
          obj.sub = sub
          obj.name = name[name.length - 1]
        } else if (obj.prefix) {
          let path = obj.prefix.split('/')
          obj.prefix = path[path.length - 2] + '/'
        }
        this.files.push(obj)
      })
      stream.on('end', () => {
        this.bucketFiles = this.files
        this.pageLoading = false
      })
    },
    search() {
      this.bucketFiles = this.files.filter((b) => {
        const name = b.name || b.prefix
        return name.indexOf(this.searchForm.key) > -1
      })
    },
    resetSearch() {
      this.searchForm.key = ''
      this.search()
      // this.getFileList(this.activeBucket, this.currentPath)
    },
    refreshFiles() {
      this.searchForm.key = ''
      this.getFileList(this.activeBucket, this.currentPath)
    },
    back() {
      const path = this.currentPath.split('/')
      if (path.length < 2) return this.refreshFiles()
      else if (path.length === 2 && path[1] === '') this.currentPath = ''
      else {
        path.splice(path.length - 2, 1)
        this.currentPath = path.join('/')
      }
      this.getFileList(this.activeBucket, this.currentPath)
    },
    isEmpty(n) {
      return n === undefined || n === null || n === ''
    },
    onContextmenu(event) {
      this.$contextmenu({
        items: [
          {
            label: '删除',
            onClick: () => {
              this.removeBucket()
            }
          }
        ],
        event, // 鼠标事件信息
        customClass: 'custom-class', // 自定义菜单 class
        zIndex: 3, // 菜单样式 z-index
        minWidth: 230 // 主菜单最小宽度
      })
    },
    createBucket() {
      if (this.createForm.name === '') return this.$message.error('Bucket名称不能为空!')
      this.minioClient.makeBucket(this.createForm.name, (err) => {
        if (err) {
          console.log('err', err)
          return this.$message.error('创建bucket失败,原因:' + err.message)
        }
        this.buckets.push({ creationDate: new Date(), name: this.createForm.name })
        this.activeBucket = this.createForm.name
        this.changeBucketPolicy(this.createForm)
        this.createForm.name = ''
        this.createForm.policy = 'public'
        this.createBucketDialogVisible = false
        this.refreshFiles()
      })
    },
    // 设置bucket 访问策略
    async changeBucketPolicy({ name, policy }) {
      const template = {
        Version: '2012-10-17',
        Statement:
          policy === 'private'
            ? []
            : [
                {
                  Effect: 'Allow',
                  Principal: { AWS: ['*'] },
                  Action: ['s3:GetBucketLocation', 's3:ListBucket', 's3:ListBucketMultipartUploads'],
                  Resource: ['arn:aws:s3:::' + name]
                },
                {
                  Effect: 'Allow',
                  Principal: { AWS: ['*'] },
                  Action: ['s3:AbortMultipartUpload', 's3:DeleteObject', 's3:GetObject', 's3:ListMultipartUploadParts', 's3:PutObject'],
                  Resource: ['arn:aws:s3:::' + name + '/*']
                }
              ]
      }
      const err = await this.minioClient.setBucketPolicy(name, JSON.stringify(template))
      if (err) console.log('err', err)
    },
    createMenu() {
      this.files.push({ prefix: '新目录/', size: 0, newMenu: true })
      this.$message.success('新目录创建成功，请往里面上传文件，空目录将会被删除！')
    },
    removeMenu(prefix) {
      this.$confirm(`无法撤回，是否要删除该目录 ${prefix}?`, '提示')
        .then(async () => {
          this.pageLoading = true
          await this.removeMenuFiles(prefix)
          this.pageLoading = false
          this.$message.success('删除目录成功！')
          this.back()
        })
        .catch(() => {})
    },
    removeMenuFiles(prefix) {
      return new Promise((resolve) => {
        const stream = this.minioClient.listObjects(this.activeBucket, this.currentPath + prefix, true)
        stream.on('data', (obj) => {
          this.removeFile(obj.name)
          console.log('删除' + obj.name)
        })
        stream.on('end', () => {
          resolve(true)
        })
      })
    },
    downMenu() {},
    removeFile(fileName) {
      return new Promise((resolve) => {
        this.minioClient.removeObject(this.activeBucket, fileName, (err) => {
          if (err) {
            console.log('删除文件失败。' + fileName, err)
            resolve(false)
          }
          const index = this.files.findIndex((i) => i.name === fileName)
          if (index > -1) this.files.splice(index, 1)
          resolve(true)
        })
      })
    },
    downFile(fileName) {
      const el = document.createElement('a')
      el.style.display = 'none'
      el.setAttribute('target', '_blank')
      const url = `${this.option.useSSL ? 'https://' : 'http://'}${this.option.endPoint}:${this.option.port}/${this.activeBucket}/${
        this.currentPath
      }${fileName}`
      console.log('path=' + url)
      el.setAttribute('download', fileName)
      el.href = url
      document.body.appendChild(el)
      el.click()
      document.body.removeChild(el)
    },
    initDragUpload() {
      const dropbox = document.getElementById(this.randomId)
      dropbox.addEventListener('drop', this.enentDrop, false)
      dropbox.addEventListener('dragleave', (e) => {
        e.stopPropagation()
        e.preventDefault()
        this.dropFileIng = false
      })
      dropbox.addEventListener('dragenter', (e) => {
        e.stopPropagation()
        e.preventDefault
        this.dropFileIng = true
      })
      dropbox.addEventListener('dragover', (e) => {
        e.stopPropagation()
        e.preventDefault()
        this.dropFileIng = true
      })

      document.onkeydown = (event) => {
        if (event.key === 'Control' && !this.showSelect && !this.selectOver) {
          this.showSelect = true
        } else if (event.key === 'Shift' && this.showSelect) {
          this.shiftEnter = true
        }
      }
      document.onkeyup = (event) => {
        if (event.key === 'Control') {
          this.showSelect = false
        } else if (event.key === 'Shift') {
          this.shiftEnter = false
        }
      }
    },
    enentDrop(e) {
      this.dropFileIng = false
      e.stopPropagation()
      e.preventDefault() //必填字段
      this.pageLoading = true
      let fileData = e.dataTransfer.files
      for (let i = 0; i !== fileData.length; i++) {
        const item = fileData[i]
        const fr = new FileReader()
        fr.readAsArrayBuffer(item) //读取文件内容,读取完成,result 属性中保存的将是被读取文件的 ArrayBuffer 数据对象.
        fr.onload = async () => {
          //文件读取成功回调
          const dataUrl = Buffer.from(fr.result) // ArrayBuffer 转成 Buffer对象
          console.log('dataUrl: ', typeof dataUrl)
          await this.putObject(item, dataUrl)
          this.$notify({
            title: '上传成功',
            message: `${item.name} 上传成功！`,
            type: 'success'
          })
          this.refreshFiles()
          this.pageLoading = false
        }
      }
    },
    putObject(item, dataUrl) {
      return new Promise((resolve) => {
        this.minioClient.putObject(
          this.activeBucket,
          this.currentPath + item.name,
          dataUrl,
          item.size,
          { 'Content-Type': item.type },
          () => {
            resolve()
          }
        )
      })
    },
    selItem(n, end) {
      if (this.showSelect) {
        if (this.shiftEnter) {
          const preSelList = this.bucketFiles.slice(0, end + 1)
          console.log('preSelList', preSelList)
          this.selectList.push(...preSelList.filter((i) => this.selectList.indexOf(i) === -1))
          return
        }
        let index = this.selectList.indexOf(n)
        if (index > -1) this.selectList.splice(index, 1)
        else this.selectList.push(n)
        console.log('触发', index)
      }
    },
    async closeSelectOverDialog(type) {
      switch (type) {
        case 'del':
          for (let i = 0; i < this.selectList.length; i++) {
            const f = this.selectList[i]
            if (f.prefix) {
              this.pageLoading = true
              await this.removeMenuFiles(f.prefix)
              this.loadingText = `正在删除第${i}/${this.selectList.length}项:${f.prefix}`
            } else {
              this.minioClient.removeObject(this.activeBucket, this.currentPath + f.name)
              this.loadingText = `正在删除第${i}/${this.selectList.length}项:${f.name}`
            }
            console.log('删除' + i, this.selectList.length)
          }
          console.log('刷新文件')
          this.refreshFiles()
          this.$message.success(`删除完成,共删除${this.selectList.length}项`)
          break
        case 'download':
          this.$message.success('正在实现中...')
          break
        case 'copy':
          this.$message.success('正在实现中...')
          break
      }
      this.selectOver = false
      this.selectList = []
    },
    getObject(name) {
      return new Promise((resolve) => {
        try {
          this.minioClient.getObject(this.activeBucket, this.currentPath + name, function (err, dataStream) {
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
    rename({ old, newName }) {
      this.$confirm('是否要重命名该文件？', '提示')
        .then(async () => {
          console.log('name', old, newName)
          const dataStrean = await this.getObject(old)
          let type = mime.getType(newName)
          this.minioClient.putObject(this.activeBucket, this.currentPath + newName, dataStrean, { 'Content-Type': type }, async () => {
            await this.removeFile(old)
            this.refreshFiles()
          })
        })
        .catch(() => {})
    },
    paste() {
      this.$message.success('正在实现中...')
    }
  },
  mounted() {
    this.initDragUpload()
  },
  created() {
    this.init()
  }
}
</script>
<style scoped>
.client-box {
  user-select: none;
}

.color-primary {
  color: #66b1ff;
}
.bucket-box {
  display: flex;
  /* flex-wrap: wrap; */
}
.bucket-item {
  width: 23%;
  /* padding: 0 10px; */
  height: 50px;
  border: 1px solid #f44336;
  border-radius: 8px;
  text-align: center;
  line-height: 50px;
  font-weight: 600;
  margin: 10px 0.948%;
  display: inline-block;
  cursor: pointer;
  user-select: none;
  transition: all 0.3s ease-in-out;
}
.bucket-item > .bucket-item-title {
  transition: all 0.3s ease-in-out;
  font-size: 22px;
}
.bucket-item:hover,
.active-bucket {
  background-color: aliceblue;
}
.bucket-item:hover > .bucket-item-title,
.active-bucket > .bucket-item-title {
  font-size: 30px;
}

.tool-box,
.current-path {
  padding: 0 10px;
  color: #333333;
  font-weight: 600;
}
.tool-box .tj-data {
  margin-right: 10px;
  float: right;
}
.tool-box .tj-data span {
  color: #2196f3;
  font-weight: 600;
  font-size: 18px;
}
.file-box {
  display: flex;
  flex-wrap: wrap;
  max-height: calc(100% - 170px);
  overflow: auto;
  transition: all 0.3s ease-in-out;
  position: relative;
}

.drop-file-ing.file-box::after {
  content: '松开鼠标即可上传';
  width: 100%;
  height: 100%;
  background: #0000005e;
  position: absolute;
  left: 0;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: aquamarine;
  font-size: 37px;
  font-weight: 600;
  border: 2px solid #6adbab;
}

.multiple-choice-box {
  position: absolute;
  width: 100%;
  height: 0%;
  left: 0;
  top: 0;
  display: flex;
  transition: all 0.3s ease-in-out;
  /* align-items: center; */
  justify-content: center;
  /* flex-direction: column; */
  background-color: #0000005e;
  color: #000000;
  font-size: 18px;
  overflow: hidden;
}
.show.multiple-choice-box {
  /* width: 100%; */
  height: 100%;
}
.show.multiple-choice-box .content {
  top: 150px;
  /* left: unset; */
}
.multiple-choice-box .content {
  width: 300px;
  transition: all 0.3s ease-in-out;
  height: 200px;
  text-align: center;
  background-color: #ffffff;
  border: 1px solid #ececec;
  line-height: 100px;
  position: absolute;
  top: 100%;
  /* left: -100%; */
  /* top: 150px; */
}
.multiple-choice-box .content .el-icon-close {
  position: absolute;
  right: 10px;
  top: 10px;
  cursor: pointer;
}
</style>
