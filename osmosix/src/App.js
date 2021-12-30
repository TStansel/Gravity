import logo from './logo.png';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <h3>Welcome to Osmosix!</h3>
        <p>
          This site is still under construction, but check us out on LinkedIn or add Osmosix to your Slack channel below!
        </p>
        <div className="Icons">
          <a target="_blank" href="https://www.linkedin.com/company/create-oasis/about/">
            <i className="fab fa-linkedin"></i>
          </a>
          <a target="_blank" href="https://slack.com/oauth/v2/authorize?scope=app_mentions%3Aread%2Cchannels%3Ahistory%2Cchannels%3Aread%2Cchat%3Awrite%2Ccommands%2Cgroups%3Ahistory%2Cim%3Ahistory%2Cim%3Aread%2Cim%3Awrite%2Cincoming-webhook%2Cmpim%3Ahistory%2Cteam%3Aread%2Cusers%3Aread&amp;user_scope=channels%3Ahistory%2Cchat%3Awrite%2Cgroups%3Ahistory&amp;redirect_uri=https%3A%2F%2Fa3rodogiwi.execute-api.us-east-2.amazonaws.com%2FDevStage%2Foauth&amp;client_id=2516673192850.2714678861750" >
            <i class="fab fa-slack"></i>
          </a>
        </div>
      </header>
    </div>
  );
}

export default App;
