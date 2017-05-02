pragma solidity ^0.4.10;


/*
    Copyright 2016, Vojtech Simetka

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/// @title Donation doubler
/// @author Vojtech Simetka, Jordi Baylina
/// @notice This contract is used to double a donation to a beneficiary as long as there
/// is some money in the contract. If not, the donated value is just send directly to beneficiary
/// with anything that may still be in this contract.

/// @dev `Owned` is a base level contract that assigns an `owner` that can be
///  later changed
contract Owned {
    /// @dev `owner` is the only address that can call a function with this
    /// modifier
    modifier onlyOwner { if (msg.sender != owner) throw; _; }

    address public owner;

    /// @notice The Constructor assigns the message sender to be `owner`
    function Owned() { owner = msg.sender;}

    /// @notice `owner` can step down and assign some other address to this role
    /// @param _newOwner The address of the new owner. 0x0 can be used to create
    ///  an unowned neutral vault, however that cannot be undone
    function changeOwner(address _newOwner) onlyOwner {
        owner = _newOwner;
        NewOwner(msg.sender, _newOwner);
    }

    event NewOwner(address indexed oldOwner, address indexed newOwner);
}
/// @dev `Escapable` is a base level contract built off of the `Owned`
///  contract that creates an escape hatch function to send its ether to
///  `escapeHatchDestination` when called by the `escapeHatchCaller` in the case that
///  something unexpected happens
contract Escapable is Owned {
    address public escapeHatchCaller;
    address public escapeHatchDestination;

    /// @notice The Constructor assigns the `escapeHatchDestination` and the
    ///  `escapeHatchCaller`
    /// @param _escapeHatchDestination The address of a safe location (usu a
    ///  Multisig) to send the ether held in this contract
    /// @param _escapeHatchCaller The address of a trusted account or contract to
    ///  call `escapeHatch()` to send the ether in this contract to the
    ///  `escapeHatchDestination` it would be ideal that `escapeHatchCaller` cannot move
    ///  funds out of `escapeHatchDestination`
    function Escapable(address _escapeHatchCaller, address _escapeHatchDestination) {
        escapeHatchCaller = _escapeHatchCaller;
        escapeHatchDestination = _escapeHatchDestination;
    }

    /// @dev The addresses preassigned the `escapeHatchCaller` role
    ///  is the only addresses that can call a function with this modifier
    modifier onlyEscapeHatchCallerOrOwner {
        if ((msg.sender != escapeHatchCaller)&&(msg.sender != owner))
            throw;
        _;
    }

    /// @notice The `escapeHatch()` should only be called as a last resort if a
    /// security issue is uncovered or something unexpected happened
    function escapeHatch() onlyEscapeHatchCallerOrOwner {
        uint total = this.balance;
        // Send the total balance of this contract to the `escapeHatchDestination`
        if (!escapeHatchDestination.send(total)) {
            throw;
        }
        EscapeHatchCalled(total);
    }
    /// @notice Changes the address assigned to call `escapeHatch()`
    /// @param _newEscapeHatchCaller The address of a trusted account or contract to
    ///  call `escapeHatch()` to send the ether in this contract to the
    ///  `escapeHatchDestination` it would be ideal that `escapeHatchCaller` cannot
    ///  move funds out of `escapeHatchDestination`
    function changeEscapeCaller(address _newEscapeHatchCaller) onlyEscapeHatchCallerOrOwner {
        escapeHatchCaller = _newEscapeHatchCaller;
    }

    event EscapeHatchCalled(uint amount);
}

/// Just an empty contract to declare porxyPayment method
contract Campaign {
    /// @notice `proxyPayment()` allows the caller to send ether to the Campaign and
    /// have the tokens created in an address of their choosing
    /// @param _owner The address that will hold the newly created tokens

    function proxyPayment(address _owner) payable returns(bool);
}

/// Main contract which doubles the amount donated.
contract DonationDoubler is Escapable{
    Campaign public beneficiary;

    /// @notice The Constructor assigns the `escapeHatchDestination` and the
    ///  `escapeHatchCaller`
    ///
    /// @param _beneficiary             The address of the vault to which a donation should be made
    /// @param _escapeHatchDestination  The address of a safe location (usually a Multisig)
    ///                                 to send the ether held in this contract
    /// @param _escapeHatchCaller       The address of a trusted account or contract to
    ///                                 call `escapeHatch()` to send the ether in this contract
    ///                                 to the `escapeHatchDestination` it would be ideal that
    ///                                 `escapeHatchCaller` cannot move funds out of
    ///                                 `escapeHatchDestination`
    function DonationDoubler(
            Campaign _beneficiary,
            address _escapeHatchCaller,
            address _escapeHatchDestination
        )
        Escapable(_escapeHatchCaller, _escapeHatchDestination)
    {
        beneficiary = _beneficiary;
    }

    /// @notice Simple function to deposit more money for the doubling algorithm
    function depositFund() payable {
        DonationDeposit(msg.sender, msg.value);
    }

    /// @notice Donate money to the beneficiary, and if there is enough in the contract
    ///         double it. The donor is rewarded with tokens.
    function () payable {
        uint amount = msg.value + this.balance;

        // There is enough money in the contract to double the money sent
        if (this.balance >= msg.value)
            amount = msg.value * 2;

        // Try and send the money to the beneficiary
        if (!beneficiary.proxyPayment.value(amount)(msg.sender))
            throw;

        DonationPaid(msg.sender, amount);
    }

    event DonationDeposit(address indexed sender, uint amount);
    event DonationPaid(address indexed sender, uint amount);
}
