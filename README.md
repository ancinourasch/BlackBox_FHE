# Encrypted Vehicle Data Recorder

Project Name: BlackBox_FHE

The Encrypted Vehicle Data Recorder (BlackBox_FHE) is a privacy-preserving application that leverages Zama's Fully Homomorphic Encryption (FHE) technology. This solution ensures that sensitive vehicle data, including driving behavior and accident records, remains confidential while allowing authorized parties to access and analyze this information during critical situations.

## The Problem

Today, traditional vehicle data recorders collect vast amounts of sensitive information, including driving habits and location data. This data, if stored in cleartext, poses significant privacy risks; unauthorized access, manipulation, or data leaks could jeopardize personal privacy and security.

For instance, insurance companies often scrutinize driving data to adjust premiums, which can lead to intrusive surveillance and loss of privacy for drivers. In the unfortunate event of an accident, sensitive data may also be exposed to third parties before the rightful owners have authorized its release. The need for a secure, privacy-focused solution to manage and utilize vehicle data has never been more pressing.

## The Zama FHE Solution

By employing Fully Homomorphic Encryption, our project addresses these privacy concerns head-on. With FHE, we can perform computations on encrypted data without ever revealing the underlying cleartext. This means that even while the data is being collected and analyzed, sensitive information remains protected.

Using Zama's fhevm, we can process encrypted inputs, ensuring that only authorized personnel, such as insurance agents and accident investigators, can decrypt the data when necessary, preserving user privacy while maintaining functionality.

## Key Features

- 🔒 **Data Privacy**: All driving-related data is stored and processed in an encrypted format, protecting it from unauthorized access.
- 🛡️ **Authorized Decryption**: The system allows for secure decryption of data only by authorized entities, ensuring that personal information is safeguarded.
- 🚗 **Accident Accountability**: In case of an accident, relevant data can be decrypted and analyzed to determine fault, aiding in fair resolution.
- 📊 **Driving Score**: The application facilitates assessment and scoring of driving behavior based on encrypted data, providing insights for drivers without compromising privacy.

## Technical Architecture & Stack

- **Zama FHE Libraries**: fhevm for executing FHE operations
- **Blockchain/DApp Framework**: Smart contracts for managing permissions and interactions
- **Backend**: Node.js for handling server-side logic and data processing
- **Database**: Utilizes encrypted storage for all recorded vehicle data

## Smart Contract / Core Logic

Here’s an example of the core logic implemented using Solidity alongside Zama’s encryption functions:

```solidity
pragma solidity ^0.8.0;

import "path_to_fhevm.sol"; // Import Zama's FHE library

contract BlackBox {
    struct VehicleData {
        uint256 timestamp;
        bytes encryptedDrivingData; // Encrypted data
    }
    
    mapping(address => VehicleData[]) public records;

    function recordData(bytes memory _encryptedData) public {
        VehicleData memory newRecord = VehicleData({
            timestamp: block.timestamp,
            encryptedDrivingData: _encryptedData
        });
        records[msg.sender].push(newRecord);
    }

    function getData(uint256 index) public view returns (bytes memory) {
        return records[msg.sender][index].encryptedDrivingData; // Access to encrypted data
    }

    function decryptData(address user, uint256 index) public {
        // Authorized decryption logic using Zama's FHE functions
        bytes memory decryptedData = TFHE.decrypt(records[user][index].encryptedDrivingData);
        // Further processing...
    }
}
```

## Directory Structure

The project's directory structure follows a clear and organized layout to facilitate ease of use:

```plaintext
BlackBox_FHE/
├── contracts/
│   └── BlackBox.sol          # Smart contract for vehicle data recording
├── scripts/
│   └── record_data.py        # Script for recording encrypted vehicle data
├── tests/
│   └── test_blackbox.py      # Unit tests for smart contract functionality
├── package.json               # Project dependencies
└── README.md                  # Project documentation
```

## Installation & Setup

### Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (version 14 or higher)
- Python (version 3.7 or higher)
- Required package managers (npm for Node.js, pip for Python)

### Installation Steps

1. **Install dependencies**: Run the following commands in your project directory to install the necessary package dependencies:

   For the JavaScript environment:
   ```bash
   npm install fhevm
   ```

   For the Python environment:
   ```bash
   pip install concrete-ml
   ```

2. **Set up the project**: Make sure to configure your environment variables and any required configuration settings for both the smart contracts and the backend server.

## Build & Run

To compile and deploy the smart contracts, execute:

```bash
npx hardhat compile
```

To run the Python script for recording data, use:

```bash
python scripts/record_data.py
```

Ensure that you have the relevant test scripts ready to verify functionality post-deployment.

## Acknowledgements

We extend our gratitude to Zama for providing the open-source Fully Homomorphic Encryption primitives that make this project possible. Their innovative technology empowers us to create secure solutions that prioritize privacy without sacrificing functionality.

