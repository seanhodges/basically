import DefaultTheme from 'vitepress/theme';
import ReferenceTable from './components/ReferenceTable.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('ReferenceTable', ReferenceTable);
  },
};
