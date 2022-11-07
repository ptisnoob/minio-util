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
      <div class="bucket-item" @click="createBucketDialogVisible = true && !isConnectFailed">
        <span class="bucket-item-title color-error" v-if="isConnectFailed"> 服务器连接失败,请检查配置</span>
        <span class="bucket-item-title color-primary" v-else> 新增Bucket</span>
      </div>
    </div>
    <div class="tool-box" v-if="activeBucket">
      <el-form inline :model="searchForm" label-width="auto">
        <el-form-item label="关键字">
          <el-input v-model="searchForm.key" placeholder="请输入关键字进行搜索" @input="search"></el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="resetSearch">重置搜索</el-button>
          <el-button type="primary" @click="showSelect = !showSelect">{{ showSelect ? '完成选择' : '开启选择' }}</el-button>
          <el-button type="primary" v-show="showSelect" plain @click="selectList = bucketFiles">全选</el-button>
          <el-button type="primary" plain @click="createMenu">新增目录</el-button>
        </el-form-item>
        <!-- <el-form-item style="float: right" v-show="currentPath !== ''">
          <el-button type="primary" @click="back">返回</el-button>
        </el-form-item> -->
        <el-form-item class="tj-data">
          总数: <span>{{ bucketFiles.length }}</span> ,文件数量:<span>{{ bucketFiles.filter((i) => i.name !== undefined).length }}</span>
          ,目录数量:<span>{{ bucketFiles.filter((i) => i.name === undefined).length }}</span>
        </el-form-item>
        <el-form-item style="float: right">
          <el-button type="primary" v-show="clipboard.length > 0" plain @click="paste">粘贴</el-button>
          <el-button type="primary" @click="refreshFiles">刷新数据</el-button>
          <el-button type="primary" v-show="currentPath !== ''" @click="back">返回</el-button>
        </el-form-item>
      </el-form>
    </div>
    <div class="current-path">
      当前路径：<span> {{ activeBucket }}</span> / <span>{{ currentPath }}</span>
    </div>
    <div :class="['file-box', { 'drop-file-ing': dropFileIng, 'show-select': showSelect }]" :id="randomId">
      <el-empty v-if="bucketFiles.length === 0" style="flex: 1"> </el-empty>
      <file-item
        v-else
        :class="{ 'is-select': selectList.indexOf(n) > -1 }"
        v-for="(n, index) in bucketFiles"
        :key="index"
        :host="host"
        :path="path"
        :n="n"
        :minioClient="minioClient"
        :imgPreviewList="imgPreviewList"
        @selItem="selItem(n, index)"
        @delMenu="removeMenu(n.prefix)"
        @downLoadMenu="downMenu(currentPath + n.prefix)"
        @showMenu="showMenu(n.prefix)"
        @delFile="removeFile(currentPath + n.name)"
        @rename="rename"
      ></file-item>
    </div>

    <el-dialog title="新建Bucket" :visible.sync="createBucketDialogVisible">
      <el-form :model="createForm" label-width="90px">
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
// const Minio = require('minio')
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
        if (this.selectList.length > 0) this.selectOver = true
      }
    }
  },
  computed: {
    host() {
      return `${this.option.useSSL ? 'https://' : 'http://'}${this.option.endPoint}:${this.option.port}`
    },
    path() {
      return `${this.activeBucket}/${this.currentPath}`
    },
    clipboard() {
      return this.$store.getters.clipboard
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
      isConnectFailed: true,
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
      if (!this.option) return this.connectFailed()
      this.minioClient = this.$minio.createClient(this.option)
      if (!this.minioClient) return this.connectFailed()
      this.$minio.getBuckets(this.minioClient).then((res) => {
        if (!res) return this.connectFailed()
        this.isConnectFailed = false
        this.buckets = res || []
        if (this.buckets.length > 0) this.selBucket(this.buckets[0].name)
        this.initDragUpload()
      })
    },
    connectFailed() {
      // this.isConnectFailed = true
      // this.$message.error('服务器连接失败！')
      this.$emit('connect-error')
    },
    selBucket(name) {
      if (this.activeBucket === name) return
      this.currentPath = ''
      this.activeBucket = name
      this.getFileList(name)
    },
    showMenu(path) {
      this.currentPath += path
      this.getFileList(this.activeBucket, this.currentPath)
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
    getFileList(bkName, path) {
      this.pageLoading = true
      this.files = []
      this.imgPreviewList = []
      this.$minio
        .getList(this.minioClient, bkName, path, false, (obj) => {
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
        .then(() => {
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
          },
          {
            label: '下载',
            onClick: () => {
              this.downMenu('', this.rightClickBucket.name)
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
      return this.$minio.getList(this.minioClient, this.activeBucket, this.currentPath + prefix, true, (obj) => {
        this.removeFile(obj.name)
      })
    },
    async downMenu(prefix, bucket) {
      this.pageLoading = true
      this.loadingText = '正在压缩中...'
      // 判断是下载目录还是整个Bucket 因为右键的时候  active还是不是目标bucket  所以要区分一下
      await this.$minio.downZIP(this.minioClient, bucket || this.activeBucket, prefix, prefix || bucket, (res) => {
        this.loadingText = `正在压缩${res.name},进度${res.index}/${res.size}....`
      })
      this.pageLoading = false
    },
    removeFile(fileName) {
      return this.$minio.del(this.minioClient, this.activeBucket, '', fileName, () => {
        const index = this.files.findIndex((i) => i.name === fileName)
        if (index > -1) this.files.splice(index, 1)
      })
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
      return this.$minio.put(this.minioClient, this.activeBucket, this.currentPath, item.name, dataUrl, item.size, item.type)
    },
    selItem(n, end) {
      if (this.showSelect) {
        if (this.shiftEnter) {
          const preSelList = this.bucketFiles.slice(0, end + 1)
          this.selectList.push(...preSelList.filter((i) => this.selectList.indexOf(i) === -1))
          return
        }
        let index = this.selectList.indexOf(n)
        if (index > -1) this.selectList.splice(index, 1)
        else this.selectList.push(n)
      }
    },
    async closeSelectOverDialog(type) {
      let copyList = []
      switch (type) {
        case 'del':
          this.$confirm('无法撤销！确定要删除这些文件吗？', '警告').then(async () => {
            for (let i = 0; i < this.selectList.length; i++) {
              const f = this.selectList[i]
              if (f.prefix) {
                this.pageLoading = true
                await this.removeMenuFiles(f.prefix)
                this.loadingText = `正在删除第${i}/${this.selectList.length}项:${f.prefix}`
              } else {
                await this.$minio.del(this.minioClient, this.activeBucket, this.currentPath, f.name)
                this.loadingText = `正在删除第${i}/${this.selectList.length}项:${f.name}`
              }
            }
            this.refreshFiles()
            this.$message.success(`删除完成,共删除${this.selectList.length}项`)
            this.selectList = []
          })
          break
        case 'download':
          this.pageLoading = true
          this.loadingText = '正在压缩中...'
          await this.$minio.downZIP2(this.minioClient, this.activeBucket, this.currentPath, this.selectList, 'minio-files', (res) => {
            this.loadingText = `正在压缩${res.name},进度${res.index}/${res.size}....`
          })
          this.pageLoading = false
          this.$message.success('下载完成！')
          this.selectList = []
          break
        case 'copy':
          for (let i = 0; i < this.selectList.length; i++) {
            const f = this.selectList[i]
            copyList.push({
              item: f,
              bucket: this.activeBucket,
              path: this.currentPath,
              client: this.minioClient,
              menu: f.prefix || false
            })
          }
          this.$store.dispatch('app/toggleClipboard', copyList)
          this.$message.success('复制成功，可在任意目录进行粘贴！')
          this.selectList = []
          break
        default:
          this.selectList = []
      }
      this.selectOver = false
    },
    getObject(name) {
      return this.$minio.get(this.minioClient, this.activeBucket, this.currentPath, name)
    },
    rename({ old, newName }) {
      this.$confirm('是否要重命名该文件？', '提示')
        .then(async () => {
          const dataStrean = await this.getObject(old)
          await this.putObject({ name: newName }, dataStrean)
          await this.removeFile(old)
          this.refreshFiles()
        })
        .catch(() => {})
    },
    async paste() {
      this.pageLoading = true
      for (let index = 0; index < this.clipboard.length; index++) {
        this.loadingText = `正在粘贴第${index + 1}/${this.clipboard.length}项..请稍等`
        const c = this.clipboard[index]
        if (c.menu) {
          const exist = this.files.some((f) => f.prefix === c.item.prefix)
          this.$minio.getList(c.client, c.bucket, c.path + c.item.prefix, true, (obj) => {
            let name = obj.name.replace(c.path, '')
            let newName = name
            if (exist) newName = 'copy_' + newName
            this.pasteOne(c, name, newName)
          })
          this.bucketFiles.push({ prefix: exist ? 'copy_' + c.item.prefix : c.item.prefix, size: 0 })
        } else {
          let name = c.item.name
          let newName = name
          if (this.files.some((f) => f.name === name)) {
            newName = name.replace(`.${c.item.sub}`, `_copy.${c.item.sub}`)
          }
          await this.pasteOne(c, c.item.name, newName, c.item.size)
          this.bucketFiles.push({ name: newName, sub: c.item.sub, size: c.item.size })
        }
      }
      this.pageLoading = false
      this.$message.success('粘贴成功...')
    },
    async pasteOne(c, fileName, newName, size) {
      const data = await this.$minio.get(c.client, c.bucket, c.path, fileName)
      if (!data) return console.log('error getting object')
      await this.$minio.put(this.minioClient, this.activeBucket, this.currentPath, newName, data, size)
    }
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
