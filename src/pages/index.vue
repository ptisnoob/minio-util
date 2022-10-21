<template>
  <div class="page">
    <div class="tool-content">
      <el-button type="primary" @click="dialogVisible = true">新增连接</el-button>
      <el-button type="primary" @click="syncDialogVisible = true">数据迁移</el-button>
      <el-button type="primary" @click="saveClient" v-if="!autoSave">保存连接</el-button>
      <el-switch
        v-model="autoSave"
        active-color="#13ce66"
        inactive-color="#ff4949"
        active-text="自动保存服务器"
        @change="changeAutoSave"
      ></el-switch>
    </div>

    <el-tabs v-model="activeClient" type="card" editable @edit="handleTabsEdit" style="height: 100%">
      <el-tab-pane v-for="item in clients" :key="item.name" :label="item.title" :name="item.name">
        <minio-client :option="item.option" style="height: 90%"></minio-client>
      </el-tab-pane>
      <el-empty v-if="clients.length === 0">
        <el-button type="primary" @click="dialogVisible = true">建立连接</el-button>
      </el-empty>
    </el-tabs>

    <el-dialog title="建立客户端连接" :visible.sync="dialogVisible">
      <el-form :model="form" label-width="auto">
        <el-form-item label="服务名称">
          <el-input v-model="form.title" placeholder="请填写服务名称"></el-input>
        </el-form-item>
        <el-form-item label="endPoint">
          <el-input v-model="form.option.endPoint" placeholder="127.0.0.1"></el-input>
        </el-form-item>
        <el-form-item label="useSSL">
          <el-select v-model="form.option.useSSL" placeholder="是否使用https协议进行连接">
            <el-option
              v-for="item in [
                { label: '是', value: true },
                { label: '否', value: false }
              ]"
              :key="item.label"
              :label="item.label"
              :value="item.value"
            >
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="port">
          <el-input v-model="form.option.port" placeholder="80|443|9000"></el-input>
        </el-form-item>
        <el-form-item label="accessKey">
          <el-input v-model="form.option.accessKey" placeholder="请填写accessKey"></el-input>
        </el-form-item>
        <el-form-item label="secretKey">
          <el-input v-model="form.option.secretKey" placeholder="请填写secretKey"></el-input>
        </el-form-item>
      </el-form>
      <div slot="footer">
        <el-button @click="dialogVisible = false">取 消</el-button>
        <el-button type="primary" @click="addClient">确 定</el-button>
      </div>
    </el-dialog>

    <el-dialog title="数据迁移" :visible.sync="syncDialogVisible">
      <template>
        <minio-sync :clients="clients" @sync-success="syncSuccess" @close="syncDialogVisible=false"></minio-sync>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import minioClient from '../components/minio-client'
import minioSync from '../components/minio-sync'
import Cache from '@/plugins/cache'
const cacheKey = 'clients'
const BaseForm = {
  name: '',
  title: '172.16.7.14',
  option: {
    endPoint: '172.16.7.14',
    port: 9000,
    useSSL: false,
    accessKey: 'talent',
    secretKey: 'talent@168'
  }
}
export default {
  components: {
    minioClient,
    minioSync
  },
  data() {
    return {
      clients: [],
      activeClient: '',
      dialogVisible: false,
      syncDialogVisible: false,
      form: Object.assign({}, BaseForm),
      autoSave: true
    }
  },
  mounted() {
    this.loadCache()
  },
  methods: {
    handleTabsEdit(targetName, action) {
      if (action === 'add') {
        this.dialogVisible = true
      } else if (action === 'remove') {
        const f = this.clients.filter((i) => i.name === targetName)
        f.forEach((i) => {
          this.clients.splice(this.clients.indexOf(i), 1)
        })
        if (this.autoSave) this.saveClient()
      }
    },
    addClient() {
      this.form.name = this.generateKey(10)
      this.clients.push(this.form)
      this.activeClient = this.form.name
      if (this.autoSave) this.saveClient()
      this.resetForm()
      this.dialogVisible = false
    },
    resetForm() {
      this.form = {
        name: '',
        title: '',
        option: {
          endPoint: '',
          port: 9000,
          useSSL: false,
          accessKey: 'talent',
          secretKey: 'talent@168'
        }
      }
    },
    generateKey(keyLength = 18) {
      let rlt = ''
      for (let i = 0; i < keyLength; i++) {
        if (Math.round(Math.random())) {
          rlt += Math.ceil(Math.random() * 9)
        } else {
          const ranNum = Math.ceil(Math.random() * 23)
          if (Math.round(Math.random())) {
            rlt += String.fromCharCode(65 + ranNum)
          } else {
            rlt += String.fromCharCode(97 + ranNum)
          }
        }
        //加上-，不要的可以去掉
        if ((i + 1) % 6 === 0 && i > 2 && i < 17) {
          rlt += '-'
        }
      }
      return rlt
    },
    syncSuccess(name) {
      console.log('name: ' + name)
    },
    saveClient() {
      Cache.local.setJSON(cacheKey, this.clients)
      this.$message.success('更新缓存成功！')
    },
    loadCache() {
      const clients = Cache.local.getJSON(cacheKey)
      const autoSave = Cache.local.getJSON('autoSave')
      if(autoSave !== undefined) this.autoSave = autoSave
      console.log('缓存服务器数量', clients.length)
      if (clients) {
        this.clients = clients
        this.activeClient = clients[0].name
      }
    },
    changeAutoSave(val) {
      Cache.local.setJSON('autoSave', val)
    }
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style>
.page {
  height: 100vh;
  width: 100%;
  overflow: hidden;
}
.tool-content {
  width: 100%;
  text-align: center;
  padding: 10px;
}
.el-tabs,
.el-tabs__content,
.el-tab-pane {
  height: 100%;
}
.el-tabs__header {
  padding: 0 10px;
}
.el-tabs__new-tab {
  background: #009688;
  font-size: 20px;
  height: 20px;
  width: 20px;
  line-height: 20px;
}
</style>
