import DefaultTheme from 'vitepress/theme';
import { defineAsyncComponent } from 'vue';
import Layout from './Layout.vue';
import ReferenceTable from './components/ReferenceTable.vue';
import EscapeTable from './components/EscapeTable.vue';
import DialectCompare from './components/DialectCompare.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  // Wraps the default layout to add an IDE-drawer close button in the nav bar
  // when the docs are embedded in the app's iframe (see Layout.vue).
  Layout,
  enhanceApp({ app }) {
    app.component('ReferenceTable', ReferenceTable);
    app.component('EscapeTable', EscapeTable);
    app.component('DialectCompare', DialectCompare);
    // Only contributing/architecture.md has ```mermaid fences. Registering the
    // wrapper asynchronously keeps it out of VitePress's app entry chunk, and
    // the wrapper import()s mermaid itself - two dynamic hops, so mermaid never
    // reaches the modulepreload list VitePress builds from the app chunk's
    // direct dynamic imports. See the `markdown.config` note in config.ts.
    app.component(
      'Mermaid',
      defineAsyncComponent(() => import('./components/Mermaid.vue')),
    );
    // Only reference/compare.md renders the machine picker, and it is React -
    // the IDE's own components, mounted as an island. Registered lazily for
    // exactly the reason Mermaid is: the wrapper import()s react-dom itself,
    // so those two dynamic hops keep it off every other page's modulepreload
    // list.
    app.component(
      'MachinePicker',
      defineAsyncComponent(() => import('./components/MachinePicker.vue')),
    );
  },
};
