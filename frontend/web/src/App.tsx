import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { getContractReadOnly, getContractWithSigner } from "./components/useContract";
import "./App.css";
import { useAccount } from 'wagmi';
import { useFhevm, useEncrypt, useDecrypt } from '../fhevm-sdk/src';
import { ethers } from 'ethers';

interface VehicleData {
  id: string;
  name: string;
  speed: string;
  mileage: string;
  fuel: string;
  timestamp: number;
  creator: string;
  publicValue1: number;
  publicValue2: number;
  isVerified?: boolean;
  decryptedValue?: number;
}

interface DrivingStats {
  safetyScore: number;
  efficiency: number;
  distance: number;
  fuelConsumption: number;
  riskLevel: number;
}

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<VehicleData[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingData, setCreatingData] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ 
    visible: false, 
    status: "pending" as const, 
    message: "" 
  });
  const [newVehicleData, setNewVehicleData] = useState({ name: "", speed: "", mileage: "", fuel: "" });
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleData | null>(null);
  const [decryptedData, setDecryptedData] = useState<{ speed: number | null; mileage: number | null }>({ speed: null, mileage: null });
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [contractAddress, setContractAddress] = useState("");
  const [fhevmInitializing, setFhevmInitializing] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
  const [stats, setStats] = useState<DrivingStats | null>(null);

  const { status, initialize, isInitialized } = useFhevm();
  const { encrypt, isEncrypting} = useEncrypt();
  const { verifyDecryption, isDecrypting: fheIsDecrypting } = useDecrypt();

  useEffect(() => {
    const initFhevmAfterConnection = async () => {
      if (!isConnected) return;
      if (isInitialized) return;
      if (fhevmInitializing) return;
      
      try {
        setFhevmInitializing(true);
        await initialize();
      } catch (error) {
        setTransactionStatus({ 
          visible: true, 
          status: "error", 
          message: "FHEVM initialization failed." 
        });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      } finally {
        setFhevmInitializing(false);
      }
    };

    initFhevmAfterConnection();
  }, [isConnected, isInitialized, initialize, fhevmInitializing]);

  useEffect(() => {
    const loadDataAndContract = async () => {
      if (!isConnected) {
        setLoading(false);
        return;
      }
      
      try {
        await loadData();
        const contract = await getContractReadOnly();
        if (contract) setContractAddress(await contract.getAddress());
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDataAndContract();
  }, [isConnected]);

  const loadData = async () => {
    if (!isConnected) return;
    
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const businessIds = await contract.getAllBusinessIds();
      const vehiclesList: VehicleData[] = [];
      
      for (const businessId of businessIds) {
        try {
          const businessData = await contract.getBusinessData(businessId);
          vehiclesList.push({
            id: businessId,
            name: businessData.name,
            speed: businessId,
            mileage: businessId,
            fuel: businessId,
            timestamp: Number(businessData.timestamp),
            creator: businessData.creator,
            publicValue1: Number(businessData.publicValue1) || 0,
            publicValue2: Number(businessData.publicValue2) || 0,
            isVerified: businessData.isVerified,
            decryptedValue: Number(businessData.decryptedValue) || 0
          });
        } catch (e) {
          console.error('Error loading vehicle data:', e);
        }
      }
      
      setVehicles(vehiclesList);
      calculateStats(vehiclesList);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Failed to load data" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setIsRefreshing(false); 
    }
  };

  const calculateStats = (vehiclesList: VehicleData[]) => {
    if (vehiclesList.length === 0) {
      setStats(null);
      return;
    }

    const totalDistance = vehiclesList.reduce((sum, v) => sum + v.publicValue1, 0);
    const totalFuel = vehiclesList.reduce((sum, v) => sum + v.publicValue2, 0);
    const avgSpeed = vehiclesList.reduce((sum, v) => sum + (v.decryptedValue || 0), 0) / vehiclesList.length;
    
    const safetyScore = Math.max(60, Math.min(95, 100 - (avgSpeed * 0.1)));
    const efficiency = totalFuel > 0 ? Math.round((totalDistance / totalFuel) * 100) / 100 : 0;
    const riskLevel = Math.max(10, Math.min(90, avgSpeed * 0.8));

    setStats({
      safetyScore,
      efficiency,
      distance: totalDistance,
      fuelConsumption: totalFuel,
      riskLevel
    });
  };

  const createVehicleData = async () => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setCreatingData(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Creating vehicle data with FHE encryption..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const speedValue = parseInt(newVehicleData.speed) || 0;
      const businessId = `vehicle-${Date.now()}`;
      
      const encryptedResult = await encrypt(contractAddress, address, speedValue);
      
      const tx = await contract.createBusinessData(
        businessId,
        newVehicleData.name,
        encryptedResult.encryptedData,
        encryptedResult.proof,
        parseInt(newVehicleData.mileage) || 0,
        parseInt(newVehicleData.fuel) || 0,
        "Vehicle Driving Data"
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Encrypting and storing data..." });
      await tx.wait();
      
      setTransactionStatus({ visible: true, status: "success", message: "Data encrypted and stored successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      await loadData();
      setShowCreateModal(false);
      setNewVehicleData({ name: "", speed: "", mileage: "", fuel: "" });
    } catch (e: any) {
      const errorMessage = e.message?.includes("user rejected transaction") 
        ? "Transaction rejected" 
        : "Submission failed";
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setCreatingData(false); 
    }
  };

  const decryptData = async (businessId: string): Promise<number | null> => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
    
    setIsDecrypting(true);
    try {
      const contractRead = await getContractReadOnly();
      if (!contractRead) return null;
      
      const businessData = await contractRead.getBusinessData(businessId);
      if (businessData.isVerified) {
        const storedValue = Number(businessData.decryptedValue) || 0;
        setTransactionStatus({ visible: true, status: "success", message: "Data verified" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
        return storedValue;
      }
      
      const contractWrite = await getContractWithSigner();
      if (!contractWrite) return null;
      
      const encryptedValueHandle = await contractRead.getEncryptedValue(businessId);
      
      const result = await verifyDecryption(
        [encryptedValueHandle],
        contractAddress,
        (abiEncodedClearValues: string, decryptionProof: string) => 
          contractWrite.verifyDecryption(businessId, abiEncodedClearValues, decryptionProof)
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Verifying decryption..." });
      
      const clearValue = result.decryptionResult.clearValues[encryptedValueHandle];
      
      await loadData();
      
      setTransactionStatus({ visible: true, status: "success", message: "Data decrypted successfully!" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
      
      return Number(clearValue);
      
    } catch (e: any) { 
      if (e.message?.includes("Data already verified")) {
        setTransactionStatus({ visible: true, status: "success", message: "Data verified" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
        await loadData();
        return null;
      }
      
      setTransactionStatus({ visible: true, status: "error", message: "Decryption failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    } finally { 
      setIsDecrypting(false); 
    }
  };

  const testAvailability = async () => {
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const available = await contract.isAvailable();
      if (available) {
        setTransactionStatus({ visible: true, status: "success", message: "FHE system is available!" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
      }
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Availability check failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const renderDashboard = () => {
    const totalRecords = vehicles.length;
    const verifiedRecords = vehicles.filter(v => v.isVerified).length;
    const avgMileage = vehicles.length > 0 
      ? vehicles.reduce((sum, v) => sum + v.publicValue1, 0) / vehicles.length 
      : 0;
    
    const recentRecords = vehicles.filter(v => 
      Date.now()/1000 - v.timestamp < 60 * 60 * 24 * 7
    ).length;

    return (
      <div className="dashboard-panels">
        <div className="panel metal-panel">
          <div className="panel-icon">📊</div>
          <h3>Total Records</h3>
          <div className="stat-value">{totalRecords}</div>
          <div className="stat-trend">+{recentRecords} this week</div>
        </div>
        
        <div className="panel metal-panel">
          <div className="panel-icon">🔐</div>
          <h3>Verified Data</h3>
          <div className="stat-value">{verifiedRecords}/{totalRecords}</div>
          <div className="stat-trend">FHE Protected</div>
        </div>
        
        <div className="panel metal-panel">
          <div className="panel-icon">🛣️</div>
          <h3>Avg Mileage</h3>
          <div className="stat-value">{avgMileage.toFixed(0)}km</div>
          <div className="stat-trend">Per Record</div>
        </div>
      </div>
    );
  };

  const renderStatsChart = () => {
    if (!stats) return null;
    
    return (
      <div className="stats-chart">
        <div className="chart-row">
          <div className="chart-label">Safety Score</div>
          <div className="chart-bar">
            <div className="bar-fill" style={{ width: `${stats.safetyScore}%` }}>
              <span className="bar-value">{stats.safetyScore}</span>
            </div>
          </div>
        </div>
        <div className="chart-row">
          <div className="chart-label">Fuel Efficiency</div>
          <div className="chart-bar">
            <div className="bar-fill" style={{ width: `${Math.min(100, stats.efficiency * 10)}%` }}>
              <span className="bar-value">{stats.efficiency} km/L</span>
            </div>
          </div>
        </div>
        <div className="chart-row">
          <div className="chart-label">Risk Level</div>
          <div className="chart-bar">
            <div className="bar-fill risk" style={{ width: `${stats.riskLevel}%` }}>
              <span className="bar-value">{stats.riskLevel}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderFHEFlow = () => {
    return (
      <div className="fhe-flow">
        <div className="flow-step">
          <div className="step-icon">1</div>
          <div className="step-content">
            <h4>Data Encryption</h4>
            <p>Vehicle speed data encrypted with FHE 🔐</p>
          </div>
        </div>
        <div className="flow-arrow">→</div>
        <div className="flow-step">
          <div className="step-icon">2</div>
          <div className="step-content">
            <h4>Secure Storage</h4>
            <p>Encrypted data stored on blockchain</p>
          </div>
        </div>
        <div className="flow-arrow">→</div>
        <div className="flow-step">
          <div className="step-icon">3</div>
          <div className="step-content">
            <h4>Accident Trigger</h4>
            <p>Authorized decryption for accident investigation</p>
          </div>
        </div>
        <div className="flow-arrow">→</div>
        <div className="flow-step">
          <div className="step-icon">4</div>
          <div className="step-content">
            <h4>Privacy Protection</h4>
            <p>Insurers cannot access data without authorization</p>
          </div>
        </div>
      </div>
    );
  };

  const faqItems = [
    {
      question: "How does FHE protect my driving data?",
      answer: "Fully Homomorphic Encryption allows your speed data to remain encrypted while being processed and stored. Only authorized parties can decrypt it during accidents."
    },
    {
      question: "Who can access my encrypted data?",
      answer: "Only you have the decryption keys. Insurance companies and other parties require your authorization to access specific data points."
    },
    {
      question: "What happens during an accident?",
      answer: "The system allows temporary authorization for investigators to decrypt relevant speed and sensor data for accident analysis."
    },
    {
      question: "Is my mileage and fuel data encrypted?",
      answer: "Speed data is FHE encrypted. Mileage and fuel consumption are stored as public data for analytics while maintaining privacy."
    }
  ];

  if (!isConnected) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="logo">
            <h1>Vehicle Privacy BlackBox 🔐</h1>
          </div>
          <div className="header-actions">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </header>
        
        <div className="connection-prompt">
          <div className="connection-content">
            <div className="connection-icon">🚗</div>
            <h2>Connect Your Wallet to Continue</h2>
            <p>Secure your vehicle data with FHE encryption. Connect your wallet to start protecting your driving privacy.</p>
            <div className="connection-steps">
              <div className="step">
                <span>1</span>
                <p>Connect wallet to initialize FHE system</p>
              </div>
              <div className="step">
                <span>2</span>
                <p>Encrypt your vehicle speed data</p>
              </div>
              <div className="step">
                <span>3</span>
                <p>Maintain privacy while enabling accident analysis</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isInitialized || fhevmInitializing) {
    return (
      <div className="loading-screen">
        <div className="fhe-spinner"></div>
        <p>Initializing FHE Encryption System...</p>
        <p className="loading-note">Securing your vehicle data</p>
      </div>
    );
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="fhe-spinner"></div>
      <p>Loading encrypted vehicle system...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <h1>Vehicle Privacy BlackBox 🔐</h1>
          <p>FHE-Protected Driving Data</p>
        </div>
        
        <div className="header-actions">
          <button onClick={testAvailability} className="test-btn">
            Test FHE System
          </button>
          <button onClick={() => setShowCreateModal(true)} className="create-btn">
            + New Record
          </button>
          <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
        </div>
      </header>
      
      <div className="main-content-container">
        <div className="dashboard-section">
          <h2>Vehicle Data Analytics Dashboard</h2>
          {renderDashboard()}
          
          <div className="panel metal-panel full-width">
            <h3>FHE Protection Flow</h3>
            {renderFHEFlow()}
          </div>

          {stats && (
            <div className="panel metal-panel full-width">
              <h3>Driving Statistics</h3>
              {renderStatsChart()}
            </div>
          )}
        </div>
        
        <div className="data-section">
          <div className="section-header">
            <h2>Vehicle Data Records</h2>
            <div className="header-actions">
              <button onClick={() => setShowFAQ(!showFAQ)} className="faq-btn">
                {showFAQ ? "Hide FAQ" : "Show FAQ"}
              </button>
              <button onClick={loadData} className="refresh-btn" disabled={isRefreshing}>
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
          
          {showFAQ && (
            <div className="faq-section">
              <h3>Frequently Asked Questions</h3>
              <div className="faq-list">
                {faqItems.map((item, index) => (
                  <div key={index} className="faq-item">
                    <div className="faq-question">{item.question}</div>
                    <div className="faq-answer">{item.answer}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="data-list">
            {vehicles.length === 0 ? (
              <div className="no-data">
                <p>No vehicle data records found</p>
                <button className="create-btn" onClick={() => setShowCreateModal(true)}>
                  Create First Record
                </button>
              </div>
            ) : vehicles.map((vehicle, index) => (
              <div className="data-item" key={index} onClick={() => setSelectedVehicle(vehicle)}>
                <div className="item-header">
                  <div className="vehicle-name">{vehicle.name}</div>
                  <div className={`status-badge ${vehicle.isVerified ? "verified" : "encrypted"}`}>
                    {vehicle.isVerified ? "✅ Verified" : "🔒 Encrypted"}
                  </div>
                </div>
                <div className="item-details">
                  <span>Mileage: {vehicle.publicValue1}km</span>
                  <span>Fuel: {vehicle.publicValue2}L</span>
                  <span>Date: {new Date(vehicle.timestamp * 1000).toLocaleDateString()}</span>
                </div>
                <div className="item-creator">By: {vehicle.creator.substring(0, 6)}...{vehicle.creator.substring(38)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {showCreateModal && (
        <ModalCreateData 
          onSubmit={createVehicleData} 
          onClose={() => setShowCreateModal(false)} 
          creating={creatingData} 
          vehicleData={newVehicleData} 
          setVehicleData={setNewVehicleData}
          isEncrypting={isEncrypting}
        />
      )}
      
      {selectedVehicle && (
        <DataDetailModal 
          vehicle={selectedVehicle} 
          onClose={() => { 
            setSelectedVehicle(null); 
            setDecryptedData({ speed: null, mileage: null }); 
          }} 
          decryptedData={decryptedData} 
          setDecryptedData={setDecryptedData} 
          isDecrypting={isDecrypting || fheIsDecrypting} 
          decryptData={() => decryptData(selectedVehicle.id)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="fhe-spinner"></div>}
              {transactionStatus.status === "success" && "✓"}
              {transactionStatus.status === "error" && "✗"}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const ModalCreateData: React.FC<{
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  vehicleData: any;
  setVehicleData: (data: any) => void;
  isEncrypting: boolean;
}> = ({ onSubmit, onClose, creating, vehicleData, setVehicleData, isEncrypting }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'speed') {
      const intValue = value.replace(/[^\d]/g, '');
      setVehicleData({ ...vehicleData, [name]: intValue });
    } else {
      setVehicleData({ ...vehicleData, [name]: value });
    }
  };

  return (
    <div className="modal-overlay">
      <div className="create-data-modal">
        <div className="modal-header">
          <h2>New Vehicle Data Record</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice">
            <strong>FHE 🔐 Encryption</strong>
            <p>Speed data will be encrypted with FHE (Integer only)</p>
          </div>
          
          <div className="form-group">
            <label>Vehicle Name *</label>
            <input 
              type="text" 
              name="name" 
              value={vehicleData.name} 
              onChange={handleChange} 
              placeholder="Enter vehicle name..." 
            />
          </div>
          
          <div className="form-group">
            <label>Speed (km/h) *</label>
            <input 
              type="number" 
              name="speed" 
              value={vehicleData.speed} 
              onChange={handleChange} 
              placeholder="Enter speed..." 
              step="1"
              min="0"
            />
            <div className="data-type-label">FHE Encrypted Integer</div>
          </div>
          
          <div className="form-group">
            <label>Mileage (km) *</label>
            <input 
              type="number" 
              min="0" 
              name="mileage" 
              value={vehicleData.mileage} 
              onChange={handleChange} 
              placeholder="Enter mileage..." 
            />
            <div className="data-type-label">Public Data</div>
          </div>

          <div className="form-group">
            <label>Fuel Consumption (L) *</label>
            <input 
              type="number" 
              min="0" 
              name="fuel" 
              value={vehicleData.fuel} 
              onChange={handleChange} 
              placeholder="Enter fuel consumption..." 
            />
            <div className="data-type-label">Public Data</div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn">Cancel</button>
          <button 
            onClick={onSubmit} 
            disabled={creating || isEncrypting || !vehicleData.name || !vehicleData.speed || !vehicleData.mileage || !vehicleData.fuel} 
            className="submit-btn"
          >
            {creating || isEncrypting ? "Encrypting..." : "Create Record"}
          </button>
        </div>
      </div>
    </div>
  );
};

const DataDetailModal: React.FC<{
  vehicle: VehicleData;
  onClose: () => void;
  decryptedData: { speed: number | null; mileage: number | null };
  setDecryptedData: (value: { speed: number | null; mileage: number | null }) => void;
  isDecrypting: boolean;
  decryptData: () => Promise<number | null>;
}> = ({ vehicle, onClose, decryptedData, setDecryptedData, isDecrypting, decryptData }) => {
  const handleDecrypt = async () => {
    if (decryptedData.speed !== null) { 
      setDecryptedData({ speed: null, mileage: null }); 
      return; 
    }
    
    const decrypted = await decryptData();
    if (decrypted !== null) {
      setDecryptedData({ speed: decrypted, mileage: decrypted });
    }
  };

  return (
    <div className="modal-overlay">
      <div className="data-detail-modal">
        <div className="modal-header">
          <h2>Vehicle Data Details</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="vehicle-info">
            <div className="info-item">
              <span>Vehicle Name:</span>
              <strong>{vehicle.name}</strong>
            </div>
            <div className="info-item">
              <span>Owner:</span>
              <strong>{vehicle.creator.substring(0, 6)}...{vehicle.creator.substring(38)}</strong>
            </div>
            <div className="info-item">
              <span>Record Date:</span>
              <strong>{new Date(vehicle.timestamp * 1000).toLocaleDateString()}</strong>
            </div>
          </div>
          
          <div className="data-section">
            <h3>Driving Data</h3>
            
            <div className="data-row">
              <div className="data-label">Speed:</div>
              <div className="data-value">
                {vehicle.isVerified && vehicle.decryptedValue ? 
                  `${vehicle.decryptedValue} km/h (Verified)` : 
                  decryptedData.speed !== null ? 
                  `${decryptedData.speed} km/h (Decrypted)` : 
                  "🔒 FHE Encrypted"
                }
              </div>
              <button 
                className={`decrypt-btn ${(vehicle.isVerified || decryptedData.speed !== null) ? 'decrypted' : ''}`}
                onClick={handleDecrypt} 
                disabled={isDecrypting}
              >
                {isDecrypting ? "Decrypting..." : vehicle.isVerified ? "✅ Verified" : decryptedData.speed !== null ? "🔄 Re-verify" : "🔓 Decrypt"}
              </button>
            </div>
            
            <div className="data-row">
              <div className="data-label">Mileage:</div>
              <div className="data-value">{vehicle.publicValue1} km</div>
              <div className="data-badge public">Public</div>
            </div>

            <div className="data-row">
              <div className="data-label">Fuel Used:</div>
              <div className="data-value">{vehicle.publicValue2} L</div>
              <div className="data-badge public">Public</div>
            </div>
            
            <div className="fhe-info">
              <div className="fhe-icon">🔐</div>
              <div>
                <strong>FHE Privacy Protection</strong>
                <p>Speed data is encrypted on-chain. Decryption requires authorization for accident investigation purposes only.</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn">Close</button>
          {!vehicle.isVerified && (
            <button onClick={handleDecrypt} disabled={isDecrypting} className="verify-btn">
              {isDecrypting ? "Verifying..." : "Authorize Decryption"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;

