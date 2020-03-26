function Loading ({ children }) {
    return (
        <div className="loading">
            <img src="/images/logo.svg"/>
            <div>{ children }</div>
        </div>
    );
}
