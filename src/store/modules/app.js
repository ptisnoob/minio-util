const state = {
  clipboard: []
}

const mutations = {
  TOGGLE_CLIPBOARD: (state, clipboard) => {
    state.clipboard = clipboard
  }
}

const actions = {
  toggleClipboard({ commit }, clipboard) {
    commit('TOGGLE_CLIPBOARD', clipboard)
  }
}

export default {
  namespaced: true,
  state,
  mutations,
  actions
}
