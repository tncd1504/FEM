function StrNod = Stress_Beam_LRZ_v1_1 (D_matp,D_matt,u)
%% Evaluates the resultant stresses at the gauss point and smooth the 
%         values to the nodes.

  global coordinates;
  global elements;

  nelem  = size(elements,1);           % Number of elements
  nnode  = size(elements,2);           % Number of nodes por element
  npnod  = size(coordinates,1);        % Number of nodes
  StrNod = zeros(npnod , 6 );          % Create array for stresses
  dofpn  = 4;                          % Number of DOF per node
  dofpe  = dofpn*nnode;                % Number of DOF per element
  eqnum  = zeros(dofpe);               % Equation number list

%  Element cycle.
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

    % One gauss point for stress evaluation
    gaus0 =  0.0;    % One Gauss point for stresses evaluation

    B_matp = [-1/len,   0  ,   0  ,   0  , 1/len,   0  ,   0  ,   0  ;
                 0  ,   0  ,-1/len,   0  ,   0  ,   0  , 1/len,   0  ;
                 0  ,   0  ,   0  ,-1/len,   0  ,   0  ,   0  , 1/len];

    B_matt = [ 0,-1/len,-(1-gaus0)/2, 0, 0, 1/len,-(1+gaus0)/2, 0;
               0,   0  ,   0  , (1-gaus0)/2, 0, 0, 0, (1+gaus0)/2];

    Str_p_g0 = D_matp * B_matp * transpose(u_elem);
    Str_t_g0 = D_matt * B_matt * transpose(u_elem);

    StrNod(lnods(1),1) = StrNod(lnods(1),1)+Str_p_g0(1);
    StrNod(lnods(2),1) = StrNod(lnods(2),1)+Str_p_g0(1);
    StrNod(lnods(1),2) = StrNod(lnods(1),2)+Str_p_g0(2);
    StrNod(lnods(2),2) = StrNod(lnods(2),2)+Str_p_g0(2);
    StrNod(lnods(1),3) = StrNod(lnods(1),3)+Str_p_g0(3);
    StrNod(lnods(2),3) = StrNod(lnods(2),3)+Str_p_g0(3);
    StrNod(lnods(1),4) = StrNod(lnods(1),4)+Str_t_g0(1);
    StrNod(lnods(2),4) = StrNod(lnods(2),4)+Str_t_g0(1);
    StrNod(lnods(1),5) = StrNod(lnods(1),5)+Str_t_g0(2);
    StrNod(lnods(2),5) = StrNod(lnods(2),5)+Str_t_g0(2);
    StrNod(lnods(1),6) = StrNod(lnods(1),6)+1;
    StrNod(lnods(2),6) = StrNod(lnods(2),6)+1;

  end

  for i = 1 : npnod
    StrNod(i,1) = StrNod(i,1)/StrNod(i,6);
    StrNod(i,2) = StrNod(i,2)/StrNod(i,6);
    StrNod(i,3) = StrNod(i,3)/StrNod(i,6);
    StrNod(i,4) = StrNod(i,4)/StrNod(i,6);
    StrNod(i,5) = StrNod(i,5)/StrNod(i,6);
  end
  

 