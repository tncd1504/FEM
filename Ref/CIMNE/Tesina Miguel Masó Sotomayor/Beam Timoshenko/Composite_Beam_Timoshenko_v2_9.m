function [lDspNod lStrNod lResStrGP] = Composite_Beam_Timoshenko_v2_9 (young,shear,kz,zlayr,D_la,D_lb,D_lab,D_ls,u)

% This script computes the layer's values to make a 2D graphic 
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
  dofpn  = 3;                         % Number of DOF per node
  dofpe  = dofpn*nnode;               % Number of DOF per element
  nndof  = npnod*dofpn;               % Number of total DOF 
  eqnum  = zeros(dofpe);              % Equation number list
  lDspNod = zeros(npnod,3,nlayr+1);   % Create array for displacements
  lStrNod = zeros(npnod,3,2*nlayr);   % Create array for stresses
  lResStrGP = zeros(nelem,4,nlayr);   % Create array for resultant stresses

%% Compute the layer displacements
% Finds the equation number list for the i-th node
  ndof1 = zeros(npnod,1);
  ndof2 = zeros(npnod,1);
  ndof3 = zeros(npnod,1);
  for nn = 1 : npnod
    ndof1(nn) = (nn-1)*dofpn + 1;
    ndof2(nn) = (nn-1)*dofpn + 2;
    ndof3(nn) = (nn-1)*dofpn + 3;
  end

  for l = 1 : nlayr + 1
    lDspNod(:,1,l) = u(ndof1) - zlayr(l)*u(ndof3);
    lDspNod(:,2,l) = u(ndof2);
    lDspNod(:,3,l) = u(ndof3);
  end

%% Comute the layer stresses and resultant stresses
% Build the constitutive matrix for stresses evaluation
  DS_a = zeros(2*nlayr,1);
  DS_b = zeros(2*nlayr,1);
  DS_s = zeros(2*nlayr,1);
  for i = 1 : nlayr
    DS_a(2*(i-1)+1) =  young(i) ;
    DS_a(2*(i-1)+2) =  young(i) ;
    DS_b(2*(i-1)+1) = -young(i)*zlayr( i ) ;
    DS_b(2*(i-1)+2) = -young(i)*zlayr(i+1) ;
    DS_s(2*(i-1)+1) =  kz*shear(i) ;
    DS_s(2*(i-1)+2) =  kz*shear(i) ;
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

    bmat_a  = [-1/len, 0, 0, 1/len, 0, 0];

    bmat_b  = [ 0, 0,-1/len, 0, 0, 1/len];

    bmat_s1 = [ 0,-1/len,-(1-gaus0)/2, 0, 1/len,-(1+gaus0)/2];
    
    p = [2 3 1];

    Str1_g0 = (DS_a*bmat_a + DS_b*bmat_b)*transpose(u_elem);
    Str2_g0 = (DS_s*bmat_s1             )*transpose(u_elem);

    lStrNod(lnods(1),1,:) = lStrNod(lnods(1),1,:) + permute(Str1_g0,p);
    lStrNod(lnods(2),1,:) = lStrNod(lnods(2),1,:) + permute(Str1_g0,p);
    lStrNod(lnods(1),2,:) = lStrNod(lnods(1),2,:) + permute(Str2_g0,p);
    lStrNod(lnods(2),2,:) = lStrNod(lnods(2),2,:) + permute(Str2_g0,p);
    lStrNod(lnods(1),3,:) = lStrNod(lnods(1),3,:) + 1;
    lStrNod(lnods(2),3,:) = lStrNod(lnods(2),3,:) + 1;

    RSt1_g0 = (D_la *bmat_a + D_lab*bmat_b)*transpose(u_elem);
    RSt2_g0 = (D_lab*bmat_a + D_lb *bmat_b)*transpose(u_elem);
    RSt3_g0 = (D_ls *bmat_s1)              *transpose(u_elem);

    lResStrGP(ielem,1,:) = permute(RSt1_g0,p);
    lResStrGP(ielem,2,:) = permute(RSt2_g0,p);
    lResStrGP(ielem,3,:) = permute(RSt3_g0,p);

  end

  for i = 1 : npnod
    lStrNod(i,1,:) = lStrNod(i,1,:)./lStrNod(i,3,:);
    lStrNod(i,2,:) = lStrNod(i,2,:)./lStrNod(i,3,:);
  end

 