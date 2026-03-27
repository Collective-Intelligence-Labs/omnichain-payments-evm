import React from 'react';

const HowItWorks: React.FC = () => {
  const steps = [
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M2 8h20" />
        </svg>
      ),
      title: 'Connect Wallet',
      desc: 'Connect your MetaMask wallet and configure the Processor and Token contract addresses.',
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
      title: 'Build Batch',
      desc: 'Add multiple token transfers to a single batch. All transfers happen in one transaction.',
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
      title: 'Sign & Submit',
      desc: 'Sign an EIP-2612 permit (no gas!) then submit. The permit authorizes the batch in one tx.',
    },
  ];

  return (
    <div className="card how-card">
      <h2 className="card-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        How It Works
      </h2>
      <div className="steps">
        {steps.map((step, i) => (
          <div key={i} className="step">
            <div className="step-icon">{step.icon}</div>
            <div className="step-content">
              <div className="step-title">
                <span className="step-number">{i + 1}</span>
                {step.title}
              </div>
              <p className="step-desc">{step.desc}</p>
            </div>
            {i < steps.length - 1 && (
              <div className="step-connector">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="features">
        <div className="feature">
          <span className="feature-icon">⚡</span>
          <span>Gas Efficient</span>
        </div>
        <div className="feature">
          <span className="feature-icon">🔒</span>
          <span>Permit-Based</span>
        </div>
        <div className="feature">
          <span className="feature-icon">📦</span>
          <span>Batch Processing</span>
        </div>
        <div className="feature">
          <span className="feature-icon">⛓️</span>
          <span>Multi-Chain</span>
        </div>
      </div>
    </div>
  );
};

export default HowItWorks;
