function [lDspNod lStrNod lResStrGP] = Composite_Beam_LRZ_v1_1 (young,shear,zlayr,phi,beta,D_lp,D_lt,u)

% This script computes the layer values to make a 2D graphic 
% representation.
% - Displacements are computed at the nodes and on each layer boundary
% - Stresses are computed on Gauss points and smooth values to nodes, for
%   each layer boundary
% - Resultant stresses are computed on Gauss points for each layer

  global coordinates;
  global elements;

  nlayr  = size(young,1);
  nelem  = size(elements,1);          % Number of elements
  nnode  = size(elements,2);          % Number of nodes por element
  npnod  = size(coordinates,1);       % Number of nodes
  dofpn  = 4;                         % Number of DOF per node
  dofpe  = dofpn*nnode;               % Number of DOF per element
  eqnum  = zeros(dofpe);              % Equation number list
  lDspNod = zeros(npnod,4,nlayr+1);   % Create array for displacements
  lStrNod = zeros(npnod,3,2*nlayr);   % Create array for stresses
  lResStrGP = zeros(nelem,5,nlayr);   % Create array for resultant stresses

%% Compute the layer displacements
% Finds the equation number list for the i-th node
  ndof1 = zeros(npnod,1);
  ndof2 = zeros(npnod,1);
  ndof3 = zeros(npnod,1);
  ndof4 = zeros(npnod,1);
  for nn = 1 : npnod
    ndof1(nn) = (nn-1)*dofpn + 1;
    ndof2(nn) = (nn-1)*dofpn + 2;
    ndof3(nn) = (nn-1)*dofpn + 3;
    ndof4(nn) = (nn-1)*dofpn + 4;
  end

  for k = 1 : nlayr + 1
    lDspNod(:,1,k) = u(ndof1) - zlayr(k)*u(ndof3) + phi(k)*u(ndof4);
    lDspNod(:,2,k) = u(ndof2);
    lDspNod(:,3,k) = u(ndof3);
    lDspNod(:,4,k) = u(ndof4)*phi(k);
  end

%% Comute the layer stresses and resultant stresses
% Build the constitutive matrix for stresses evaluation
  E_Sp = zeros(2*nlayr,3);
  G_St = zeros(2*nlayr,2);
  for k = 1 : nlayr
    E_Sp(2*(k-1)+1,:) = young(k)*[ 1 ,-zlayr( k ), phi( k ) ];
    E_Sp(2*(k-1)+2,:) = young(k)*[ 1 ,-zlayr(k+1), phi(k+1) ];
    G_St(2*(k-1)+1,:) = shear(k)*[ 1 , beta(k)];
    G_St(2*(k-1)+2,:) = shear(k)*[ 1 , beta(k)];
  end

  % Element cycle.
  for ielem = 1 : nelem

    lnods(1:nnode) = elements(ielem,1:nnode);

    coor_x(1:nnode) = coordinates(lnods(1:nnode),1); % Elem. X coordinate

    % Finds the equation number list for the i-th element
    for i=1:nnode
      ii = (i-1)*dofpn;
      for j =1:dofpn
        eqnum(ii+j) = (lnods(i)-1)*dofpn+j; % Build the equation number list
      end
    end

    % Recover the nodal displacements for the i-th element
    u_elem(1:dofpe)=u(eqnum(1:dofpe));

    len = coor_x(2) - coor_x(1);  % x_j > x_i

    % One gauss point for stresses evaluation
    gaus0 =  0.0;

    B_matp = [-1/len,   0  ,   0  ,   0  , 1/len,   0  ,   0  ,   0  ;
                 0  ,   0  ,-1/len,   0  ,   0  ,   0  , 1/len,   0  ;
                 0  ,   0  ,   0  ,-1/len,   0  ,   0  ,   0  , 1/len];

    B_matt = [ 0,-1/len,-(1-gaus0)/2, 0, 0, 1/len,-(1+gaus0)/2, 0;
               0,   0  ,   0  , (1-gaus0)/2, 0, 0, 0, (1+gaus0)/2];
    
    p = [2 3 1];

    Str1_g0 = E_Sp*B_matp*transpose(u_elem);
    Str2_g0 = G_St*B_matt*transpose(u_elem);

    lStrNod(lnods(1),1,:) = lStrNod(lnods(1),1,:) + permute(Str1_g0,p);
    lStrNod(lnods(2),1,:) = lStrNod(lnods(2),1,:) + permute(Str1_g0,p);
    lStrNod(lnods(1),2,:) = lStrNod(lnods(1),2,:) + permute(Str2_g0,p);
    lStrNod(lnods(2),2,:) = lStrNod(lnods(2),2,:) + permute(Str2_g0,p);
    lStrNod(lnods(1),3,:) = lStrNod(lnods(1),3,:) + 1;
    lStrNod(lnods(2),3,:) = lStrNod(lnods(2),3,:) + 1;

    for k = 1 : nlayr
      lResStrGP(ielem,1:3,k) = D_lp(:,:,k)*B_matp*transpose(u_elem);
      lResStrGP(ielem,4:5,k) = D_lt(:,:,k)*B_matt*transpose(u_elem);
    end

  end

  for i = 1 : npnod
    lStrNod(i,1,:) = lStrNod(i,1,:)./lStrNod(i,3,:);
    lStrNod(i,2,:) = lStrNod(i,2,:)./lStrNod(i,3,:);
  end

 