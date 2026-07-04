import DefaultTheme from 'vitepress/theme';
import Layout from './Layout.vue';
import ReferenceTable from './components/ReferenceTable.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  // Wraps the default layout to add an IDE-drawer close button in the nav bar
  // when the docs are embedded in the app's iframe (see Layout.vue).
  Layout,
  enhanceApp({ app }) {
    app.component('ReferenceTable', ReferenceTable);
  },
};
