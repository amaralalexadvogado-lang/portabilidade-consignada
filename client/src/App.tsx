import { Route, Switch } from "wouter";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Messages from "./pages/Messages";
import Upload from "./pages/Upload";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/clients" component={Clients} />
        <Route path="/messages" component={Messages} />
        <Route path="/upload" component={Upload} />
        <Route path="/settings" component={Settings} />
        <Route>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Página não encontrada
          </div>
        </Route>
      </Switch>
    </Layout>
  );
}
