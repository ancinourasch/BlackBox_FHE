pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract VehicleDataRecorder is ZamaEthereumConfig {
    
    struct VehicleData {
        string vehicleId;
        euint32 encryptedSpeed;
        euint32 encryptedRPM;
        uint256 publicOdometer;
        uint256 publicFuelLevel;
        string description;
        address owner;
        uint256 timestamp;
        uint32 decryptedSpeed;
        uint32 decryptedRPM;
        bool isDecrypted;
    }
    
    mapping(string => VehicleData) public vehicleData;
    string[] public vehicleIds;
    
    event VehicleDataRecorded(string indexed vehicleId, address indexed owner);
    event DataDecrypted(string indexed vehicleId, uint32 speed, uint32 rpm);
    
    constructor() ZamaEthereumConfig() {
    }
    
    function recordVehicleData(
        string calldata vehicleId,
        string calldata description,
        externalEuint32 encryptedSpeed,
        bytes calldata speedProof,
        externalEuint32 encryptedRPM,
        bytes calldata rpmProof,
        uint256 publicOdometer,
        uint256 publicFuelLevel
    ) external {
        require(bytes(vehicleData[vehicleId].vehicleId).length == 0, "Vehicle data already exists");
        
        require(FHE.isInitialized(FHE.fromExternal(encryptedSpeed, speedProof)), "Invalid encrypted speed");
        require(FHE.isInitialized(FHE.fromExternal(encryptedRPM, rpmProof)), "Invalid encrypted RPM");
        
        vehicleData[vehicleId] = VehicleData({
            vehicleId: vehicleId,
            encryptedSpeed: FHE.fromExternal(encryptedSpeed, speedProof),
            encryptedRPM: FHE.fromExternal(encryptedRPM, rpmProof),
            publicOdometer: publicOdometer,
            publicFuelLevel: publicFuelLevel,
            description: description,
            owner: msg.sender,
            timestamp: block.timestamp,
            decryptedSpeed: 0,
            decryptedRPM: 0,
            isDecrypted: false
        });
        
        FHE.allowThis(vehicleData[vehicleId].encryptedSpeed);
        FHE.allowThis(vehicleData[vehicleId].encryptedRPM);
        
        FHE.makePubliclyDecryptable(vehicleData[vehicleId].encryptedSpeed);
        FHE.makePubliclyDecryptable(vehicleData[vehicleId].encryptedRPM);
        
        vehicleIds.push(vehicleId);
        
        emit VehicleDataRecorded(vehicleId, msg.sender);
    }
    
    function decryptData(
        string calldata vehicleId,
        bytes memory abiEncodedSpeed,
        bytes memory speedProof,
        bytes memory abiEncodedRPM,
        bytes memory rpmProof
    ) external {
        require(bytes(vehicleData[vehicleId].vehicleId).length > 0, "Vehicle data does not exist");
        require(!vehicleData[vehicleId].isDecrypted, "Data already decrypted");
        
        bytes32[] memory speedCts = new bytes32[](1);
        speedCts[0] = FHE.toBytes32(vehicleData[vehicleId].encryptedSpeed);
        
        bytes32[] memory rpmCts = new bytes32[](1);
        rpmCts[0] = FHE.toBytes32(vehicleData[vehicleId].encryptedRPM);
        
        FHE.checkSignatures(speedCts, abiEncodedSpeed, speedProof);
        FHE.checkSignatures(rpmCts, abiEncodedRPM, rpmProof);
        
        uint32 decodedSpeed = abi.decode(abiEncodedSpeed, (uint32));
        uint32 decodedRPM = abi.decode(abiEncodedRPM, (uint32));
        
        vehicleData[vehicleId].decryptedSpeed = decodedSpeed;
        vehicleData[vehicleId].decryptedRPM = decodedRPM;
        vehicleData[vehicleId].isDecrypted = true;
        
        emit DataDecrypted(vehicleId, decodedSpeed, decodedRPM);
    }
    
    function getEncryptedData(string calldata vehicleId) external view returns (euint32, euint32) {
        require(bytes(vehicleData[vehicleId].vehicleId).length > 0, "Vehicle data does not exist");
        return (vehicleData[vehicleId].encryptedSpeed, vehicleData[vehicleId].encryptedRPM);
    }
    
    function getVehicleData(string calldata vehicleId) external view returns (
        string memory vehicleId_,
        uint256 publicOdometer,
        uint256 publicFuelLevel,
        string memory description,
        address owner,
        uint256 timestamp,
        bool isDecrypted,
        uint32 decryptedSpeed,
        uint32 decryptedRPM
    ) {
        require(bytes(vehicleData[vehicleId].vehicleId).length > 0, "Vehicle data does not exist");
        VehicleData storage data = vehicleData[vehicleId];
        
        return (
            data.vehicleId,
            data.publicOdometer,
            data.publicFuelLevel,
            data.description,
            data.owner,
            data.timestamp,
            data.isDecrypted,
            data.decryptedSpeed,
            data.decryptedRPM
        );
    }
    
    function getAllVehicleIds() external view returns (string[] memory) {
        return vehicleIds;
    }
    
    function isAvailable() public pure returns (bool) {
        return true;
    }
}

